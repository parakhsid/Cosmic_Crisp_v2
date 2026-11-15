#!/usr/bin/env python3
"""
CropNext In-Memory Geospatial Data-Ingestion Module.

Streams open-source global geospatial and agricultural datasets directly into
memory (xarray / rioxarray) without writing intermediate raster files to disk:
  1. Microsoft Planetary Computer (pystac-client + planetary-computer + rioxarray + xrspatial)
  2. NASA Earthdata Cloud (earthaccess + xarray via HTTP/S3 virtual file streams)
  3. ISRIC SoilGrids v2.0 (rioxarray via GDAL /vsicurl/ .vrt streams)

All layers are reprojected and aligned onto a unified EPSG:4326 grid, summarized
(mean, min, max) for the requested bounding box or polygon, and emitted as a
structured JSON payload for downstream statistical & Gemini AI analysis.
"""

from __future__ import annotations

import os

# Optimize GDAL /vsicurl/ HTTP streaming before importing rasterio/rioxarray
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".vrt,.tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "1")

import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import json
import math
import traceback
from typing import Any

import numpy as np
import xarray as xr
import rioxarray  # noqa: F401 - registers .rio accessor on xarray objects
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds


PLANETARY_COMPUTER_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
SOILGRIDS_VRT_BASE = "/vsicurl/https://files.isric.org/soilgrids/latest/data"
TARGET_CRS = "EPSG:4326"


def build_unified_grid(
    bbox: tuple[float, float, float, float],
    width: int = 24,
    height: int = 24,
) -> xr.DataArray:
    """Create an in-memory EPSG:4326 reference grid for reproject_match alignment."""
    minx, miny, maxx, maxy = bbox
    xs = np.linspace(minx, maxx, width, dtype=np.float64)
    ys = np.linspace(maxy, miny, height, dtype=np.float64)
    grid = xr.DataArray(
        np.zeros((height, width), dtype=np.float32),
        coords={"y": ys, "x": xs},
        dims=("y", "x"),
        name="template_grid",
    )
    grid = grid.rio.write_crs(TARGET_CRS)
    return grid


def normalize_bbox(
    lat: float,
    lon: float,
    bbox: list[float] | None = None,
    buffer_deg: float = 0.05,
) -> tuple[float, float, float, float]:
    """Return (minx, miny, maxx, maxy) in EPSG:4326."""
    if bbox and len(bbox) == 4:
        minx, miny, maxx, maxy = [float(v) for v in bbox]
        if minx < maxx and miny < maxy:
            return (
                round(max(-180.0, minx), 6),
                round(max(-85.0, miny), 6),
                round(min(180.0, maxx), 6),
                round(min(85.0, maxy), 6),
            )
    return (
        round(max(-180.0, lon - buffer_deg), 6),
        round(max(-85.0, lat - buffer_deg), 6),
        round(min(180.0, lon + buffer_deg), 6),
        round(min(85.0, lat + buffer_deg), 6),
    )


def _clip_in_source_crs(
    da: xr.DataArray,
    bbox_4326: tuple[float, float, float, float],
    pad_fraction: float = 0.35,
) -> xr.DataArray:
    """Clip a rioxarray DataArray in its native CRS before reprojection to stream only needed windows."""
    minx, miny, maxx, maxy = bbox_4326
    dx = (maxx - minx) * pad_fraction
    dy = (maxy - miny) * pad_fraction
    padded_4326 = (minx - dx, miny - dy, maxx + dx, maxy + dy)
    src_crs = da.rio.crs
    if src_crs is None:
        da = da.rio.write_crs(TARGET_CRS)
        src_crs = TARGET_CRS
    if str(src_crs).upper() != TARGET_CRS:
        src_bounds = transform_bounds(TARGET_CRS, src_crs, *padded_4326, densify_pts=8)
    else:
        src_bounds = padded_4326
    return da.rio.clip_box(*src_bounds, allow_one_dimensional_raster=True)


def align_to_unified_grid(
    da: xr.DataArray,
    template_grid: xr.DataArray,
    polygon_geojson: dict[str, Any] | None = None,
) -> xr.DataArray:
    """Reproject a DataArray onto the unified EPSG:4326 grid and optionally mask to polygon."""
    if "band" in da.dims:
        da = da.isel(band=0, drop=True)
    if da.rio.crs is None:
        da = da.rio.write_crs(TARGET_CRS)

    nodata = da.rio.nodata
    da_f = da.astype(np.float32)
    if nodata is not None and np.isfinite(nodata):
        da_f = da_f.where(da_f != float(nodata))
    da_f = da_f.rio.write_nodata(np.nan)

    aligned = da_f.rio.reproject_match(
        template_grid,
        resampling=Resampling.bilinear,
        nodata=np.nan,
    ).astype(np.float32)

    if polygon_geojson:
        try:
            aligned = aligned.rio.clip([polygon_geojson], crs=TARGET_CRS, drop=False)
        except Exception:
            pass
    return aligned


def summarize_layer(
    da: xr.DataArray,
    units: str,
    dataset: str,
    notes: str | None = None,
) -> dict[str, Any]:
    """Extract mean, min, max summary statistics from an aligned xarray DataArray."""
    vals = np.asarray(da.values, dtype=np.float64)
    vals = vals[np.isfinite(vals)]
    if vals.size == 0:
        return {
            "mean": None,
            "min": None,
            "max": None,
            "validPixels": 0,
            "units": units,
            "dataset": dataset,
            "notes": notes or "No finite pixels in bounds",
        }
    return {
        "mean": round(float(np.mean(vals)), 3),
        "min": round(float(np.min(vals)), 3),
        "max": round(float(np.max(vals)), 3),
        "validPixels": int(vals.size),
        "units": units,
        "dataset": dataset,
        **({"notes": notes} if notes else {}),
    }


def _estimate_utm_epsg(lat: float, lon: float) -> str:
    zone = int(math.floor((lon + 180.0) / 6.0) + 1)
    base = 32600 if lat >= 0 else 32700
    return f"EPSG:{base + zone}"


def _open_era5_asset(asset: Any) -> xr.Dataset:
    open_kwargs = dict(asset.extra_fields.get("xarray:open_kwargs") or {})
    if not open_kwargs:
        open_kwargs = {"engine": "zarr", "consolidated": True}
    return xr.open_dataset(asset.href, **open_kwargs)


def _normalize_era5_lon(da: xr.DataArray) -> xr.DataArray:
    if float(da.x.max()) > 180:
        da = da.assign_coords(x=(((da.x + 180) % 360) - 180)).sortby("x")
    return da.rio.write_crs(TARGET_CRS)


def ingest_planetary_computer(
    lat: float,
    lon: float,
    bbox: tuple[float, float, float, float],
    template_grid: xr.DataArray,
    polygon_geojson: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Stream NASADEM (slope in degrees), MODIS Land Cover Dynamics (modis-12Q2-061
    with modis-13Q1-061 phenology fallback), GPM IMERG precipitation, and ERA5
    (humidity, minimum temperature, precipitation) from Microsoft Planetary
    Computer STAC directly into xarray memory.
    """
    import planetary_computer
    import pystac_client
    from xrspatial import slope as xrspatial_slope

    result: dict[str, Any] = {
        "status": "ok",
        "stacEndpoint": PLANETARY_COMPUTER_STAC,
        "gridCrs": TARGET_CRS,
        "layers": {},
        "warnings": [],
    }

    catalog = pystac_client.Client.open(
        PLANETARY_COMPUTER_STAC,
        modifier=planetary_computer.sign_inplace,
    )

    # 1. NASADEM elevation -> terrain slope in degrees via xrspatial
    try:
        dem_search = catalog.search(collections=["nasadem"], bbox=bbox, max_items=2)
        dem_items = list(dem_search.items())
        if dem_items:
            href = dem_items[0].assets["elevation"].href
            dem_da = rioxarray.open_rasterio(href, chunks="auto")
            dem_clip = _clip_in_source_crs(dem_da, bbox, pad_fraction=0.5).load()
            dem_2d = dem_clip.isel(band=0, drop=True) if "band" in dem_clip.dims else dem_clip
            dem_nodata = dem_2d.rio.nodata
            dem_2d = dem_2d.astype(np.float32)
            if dem_nodata is not None and np.isfinite(dem_nodata):
                dem_2d = dem_2d.where(dem_2d != float(dem_nodata))
            dem_2d = dem_2d.where(dem_2d > -500).rio.write_nodata(np.nan)

            utm_crs = _estimate_utm_epsg(lat, lon)
            dem_utm = dem_2d.rio.reproject(
                utm_crs, resampling=Resampling.bilinear, nodata=np.nan
            )
            slope_utm = (
                xrspatial_slope(dem_utm)
                .where(lambda s: (s >= 0.0) & (s <= 90.0))
                .rio.write_crs(utm_crs)
                .rio.write_nodata(np.nan)
            )

            elev_aligned = align_to_unified_grid(dem_2d, template_grid, polygon_geojson)
            slope_aligned = align_to_unified_grid(slope_utm, template_grid, polygon_geojson)

            result["layers"]["elevation_m"] = summarize_layer(
                elev_aligned, "m", "nasadem"
            )
            result["layers"]["terrain_slope_deg"] = summarize_layer(
                slope_aligned, "degrees", "nasadem+xrspatial"
            )
        else:
            result["warnings"].append("No NASADEM items found for bounding box")
    except Exception as exc:
        result["warnings"].append(f"NASADEM error: {exc}")

    # 2. MODIS Land Cover Dynamics (modis-12Q2-061): Growing Season = Dormancy - Greenup
    #    with automatic fallback to modis-13Q1-061 250m NDVI seasonal phenology
    modis_loaded = False
    try:
        modis_search = catalog.search(
            collections=["modis-12Q2-061"],
            bbox=bbox,
            max_items=2,
        )
        modis_items = list(modis_search.items())
        if modis_items:
            item = modis_items[0]
            green_asset = item.assets.get("Greenup")
            dorm_asset = item.assets.get("Dormancy")
            if green_asset and dorm_asset:
                g_da = rioxarray.open_rasterio(green_asset.href, chunks="auto")
                d_da = rioxarray.open_rasterio(dorm_asset.href, chunks="auto")
                g_clip = _clip_in_source_crs(g_da, bbox).load()
                d_clip = _clip_in_source_crs(d_da, bbox).load()

                if "band" in g_clip.dims:
                    g_clip = g_clip.isel(band=0, drop=True)
                if "band" in d_clip.dims:
                    d_clip = d_clip.isel(band=0, drop=True)

                g_valid = g_clip.where((g_clip > 0) & (g_clip < 32700))
                d_valid = d_clip.where((d_clip > 0) & (d_clip < 32700))
                gsl = (d_valid - g_valid).where(lambda x: (x > 15) & (x < 366))
                gsl = gsl.rio.write_crs(g_clip.rio.crs)

                gsl_aligned = align_to_unified_grid(gsl, template_grid, polygon_geojson)
                result["layers"]["growing_season_days"] = summarize_layer(
                    gsl_aligned,
                    "days",
                    "modis-12Q2-061",
                    notes=f"Dormancy minus Greenup ({item.id})",
                )
                modis_loaded = True
    except Exception as exc:
        result["warnings"].append(f"MODIS 12Q2 note: {exc}")

    if not modis_loaded:
        try:
            # Query 2024 annual stack of 16-day 250m NDVI composites to estimate active greenup-to-dormancy span
            ndvi_search = catalog.search(
                collections=["modis-13Q1-061"],
                bbox=bbox,
                datetime="2024-01-01/2024-12-31",
                max_items=24,
            )
            ndvi_items = list(ndvi_search.items())
            if len(ndvi_items) >= 6:
                # Sample up to 12 evenly spaced composites across the year for low latency
                step = max(1, len(ndvi_items) // 12)
                sampled_items = ndvi_items[::step]

                def _load_ndvi_slice(stac_item: Any) -> xr.DataArray | None:
                    ndvi_asset = stac_item.assets.get("250m_16_days_NDVI")
                    if not ndvi_asset:
                        return None
                    da = rioxarray.open_rasterio(ndvi_asset.href)
                    clip = _clip_in_source_crs(da, bbox, pad_fraction=0.2).load()
                    if "band" in clip.dims:
                        clip = clip.isel(band=0, drop=True)
                    scaled = (clip.where(clip > -2000) * 0.0001).rio.write_crs(clip.rio.crs)
                    return align_to_unified_grid(scaled, template_grid, polygon_geojson)

                with ThreadPoolExecutor(max_workers=4) as pool:
                    slices = [s for s in pool.map(_load_ndvi_slice, sampled_items) if s is not None]

                if slices:
                    stack = xr.concat(slices, dim="composite")
                    ndvi_min = stack.min(dim="composite", skipna=True)
                    ndvi_max = stack.max(dim="composite", skipna=True)
                    threshold = ndvi_min + 0.35 * (ndvi_max - ndvi_min)
                    active_fraction = (stack >= threshold).mean(dim="composite", skipna=True)
                    gsl_est = (active_fraction * 365.0).where(active_fraction > 0)
                    gsl_est = gsl_est.rio.write_crs(TARGET_CRS)
                    result["layers"]["growing_season_days"] = summarize_layer(
                        gsl_est,
                        "days",
                        "modis-13Q1-061",
                        notes="Derived from 2024 16-day NDVI greenup-dormancy cycle (modis-12Q2-061 unavailable in PC STAC)",
                    )
                    modis_loaded = True
            if not modis_loaded:
                result["warnings"].append("MODIS growing season items unavailable for bounding box")
        except Exception as exc:
            result["warnings"].append(f"MODIS 13Q1 phenology error: {exc}")

    # 3. ERA5 Climate (minimum temperature, relative humidity, and precipitation via Zarr)
    try:
        era5_search = catalog.search(
            collections=["era5-pds"],
            datetime="2020-07-01/2020-12-31",
            sortby=[{"field": "properties.datetime", "direction": "desc"}],
            max_items=6,
        )
        era5_items = list(era5_search.items())
        # Collect fc and an assets from the same latest month
        assets_by_key: dict[str, Any] = {}
        for it in era5_items:
            for k, a in it.assets.items():
                assets_by_key.setdefault(k, a)

        minx, miny, maxx, maxy = bbox
        lon_360 = [x if x >= 0 else x + 360.0 for x in (minx, maxx)]
        lat_slice = slice(maxy + 0.75, miny - 0.75)
        lon_slice = slice(min(lon_360) - 0.75, max(lon_360) + 0.75)

        t_asset = assets_by_key.get("air_temperature_at_2_metres")
        t_min_asset = assets_by_key.get("air_temperature_at_2_metres_1hour_Minimum")
        td_asset = assets_by_key.get("dew_point_temperature_at_2_metres")
        p_asset = assets_by_key.get("precipitation_amount_1hour_Accumulation")

        if t_min_asset or t_asset:
            src_asset = t_min_asset or t_asset
            t_ds = _open_era5_asset(src_asset)
            t_var = list(t_ds.data_vars)[0]
            # Sample every 6 hours across the month for rapid streaming
            t_sub = (
                t_ds[t_var]
                .sel(lat=lat_slice, lon=lon_slice)
                .isel(time=slice(None, None, 6))
                .load()
            )
            t_min_c = (t_sub - 273.15).min(dim="time", skipna=True)
            t_min_c = _normalize_era5_lon(t_min_c.rename({"lat": "y", "lon": "x"}))
            t_min_aligned = align_to_unified_grid(t_min_c, template_grid, polygon_geojson)
            result["layers"]["era5_temp_min_c"] = summarize_layer(
                t_min_aligned, "degC", "era5-pds"
            )

        if t_asset and td_asset:
            ta_ds = _open_era5_asset(t_asset)
            td_ds = _open_era5_asset(td_asset)
            ta_var = list(ta_ds.data_vars)[0]
            td_var = list(td_ds.data_vars)[0]
            ta_c = (
                ta_ds[ta_var]
                .sel(lat=lat_slice, lon=lon_slice)
                .isel(time=slice(None, None, 6))
                .load()
                - 273.15
            )
            td_c = (
                td_ds[td_var]
                .sel(lat=lat_slice, lon=lon_slice)
                .isel(time=slice(None, None, 6))
                .load()
                - 273.15
            )
            rh = 100.0 * (
                np.exp((17.625 * td_c) / (243.04 + td_c))
                / np.exp((17.625 * ta_c) / (243.04 + ta_c))
            )
            rh_mean = _normalize_era5_lon(
                rh.clip(0, 100).mean(dim="time", skipna=True).rename({"lat": "y", "lon": "x"})
            )
            rh_aligned = align_to_unified_grid(rh_mean, template_grid, polygon_geojson)
            result["layers"]["era5_relative_humidity_pct"] = summarize_layer(
                rh_aligned, "%", "era5-pds"
            )

        if p_asset:
            p_ds = _open_era5_asset(p_asset)
            p_var = list(p_ds.data_vars)[0]
            p_sub = (
                p_ds[p_var]
                .sel(lat=lat_slice, lon=lon_slice)
                .isel(time=slice(None, None, 6))
                .load()
            )
            # Multiply mean 1-hour accumulation (meters) by 24*30*1000 -> monthly mm
            p_mm = _normalize_era5_lon(
                (p_sub.mean(dim="time", skipna=True) * 24.0 * 30.0 * 1000.0).rename(
                    {"lat": "y", "lon": "x"}
                )
            )
            p_aligned = align_to_unified_grid(p_mm, template_grid, polygon_geojson)
            result["layers"]["era5_precip_mm"] = summarize_layer(
                p_aligned, "mm/month", "era5-pds"
            )
    except Exception as exc:
        result["warnings"].append(f"ERA5 stream note: {exc}")

    # 4. GPM IMERG collection check on Planetary Computer STAC
    try:
        gpm_search = catalog.search(
            collections=["gpm-imerg-hhr"],
            bbox=bbox,
            max_items=1,
        )
        gpm_items = list(gpm_search.items())
        if gpm_items:
            item = gpm_items[0]
            first_asset = next(iter(item.assets.values()), None)
            if first_asset and ".tif" in first_asset.href:
                gpm_da = rioxarray.open_rasterio(first_asset.href, chunks="auto")
                gpm_clip = _clip_in_source_crs(gpm_da, bbox).load()
                gpm_aligned = align_to_unified_grid(gpm_clip, template_grid, polygon_geojson)
                result["layers"]["pc_gpm_imerg_mm"] = summarize_layer(
                    gpm_aligned, "mm/hr", "gpm-imerg-hhr"
                )
        else:
            result["warnings"].append(
                "Planetary Computer STAC currently indexes 0 gpm-imerg-hhr items; precipitation covered by ERA5 PDS & NASA Earthdata GPM_3IMERGDF."
            )
    except Exception as exc:
        result["warnings"].append(f"Planetary Computer GPM IMERG note: {exc}")

    if not result["layers"] and result["warnings"]:
        result["status"] = "partial"
    return result


def ingest_nasa_earthdata(
    lat: float,
    lon: float,
    bbox: tuple[float, float, float, float],
    template_grid: xr.DataArray,
    polygon_geojson: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Query NASA Earthdata CMR for the latest granules, authenticate with
    EARTHDATA_USERNAME / EARTHDATA_PASSWORD, and stream:
      - SMAP Level 4 Soil Moisture (SPL4SMGP v008 -> sm_surface, sm_rootzone)
      - GPM IMERG (GPM_3IMERGDF with GPM_3IMERGDL fallback)
      - MODIS / VIIRS Land Cover Dynamics (MCD12Q2 / VNP22Q2)
      - NASADEM (NASADEM_HGT via in-memory zip + MemoryFile, zero disk writes)
    directly via HTTP/S3 virtual file streams into xarray without writing files to disk.
    """
    import io
    import zipfile
    import earthaccess
    from rasterio.io import MemoryFile
    from xrspatial import slope as xrspatial_slope

    now = dt.datetime.now(dt.timezone.utc)
    start_60d = (now - dt.timedelta(days=60)).strftime("%Y-%m-%d")
    start_180d = (now - dt.timedelta(days=180)).strftime("%Y-%m-%d")
    end_today = now.strftime("%Y-%m-%d")

    discovered: dict[str, str] = {}
    cmr_warnings: list[str] = []
    smap_granules: list[Any] = []
    gpm_granules: list[Any] = []
    gpm_short_name = "GPM_3IMERGDF"
    pheno_granules: list[Any] = []
    pheno_short_name = "VNP22Q2"
    nd_granules: list[Any] = []

    try:
        smap_granules = earthaccess.search_data(
            short_name="SPL4SMGP",
            version="008",
            bounding_box=bbox,
            temporal=(start_60d, end_today),
            sort_key="-start_date",
            count=1,
        )
        if smap_granules:
            discovered["SPL4SMGP_v008"] = smap_granules[0].data_links()[0].split("/")[-1]
    except Exception as exc:
        cmr_warnings.append(f"CMR SPL4SMGP query note: {exc}")

    try:
        gpm_granules = earthaccess.search_data(
            short_name="GPM_3IMERGDF",
            version="07",
            bounding_box=bbox,
            temporal=(start_180d, end_today),
            sort_key="-start_date",
            count=1,
        )
        if not gpm_granules:
            gpm_short_name = "GPM_3IMERGDL"
            gpm_granules = earthaccess.search_data(
                short_name="GPM_3IMERGDL",
                version="07",
                bounding_box=bbox,
                temporal=(start_60d, end_today),
                sort_key="-start_date",
                count=1,
            )
        if gpm_granules:
            discovered[gpm_short_name] = gpm_granules[0].data_links()[0].split("/")[-1]
    except Exception as exc:
        cmr_warnings.append(f"CMR GPM IMERG query note: {exc}")

    try:
        mcd_check = earthaccess.search_data(
            short_name="MCD12Q2",
            version="061",
            bounding_box=bbox,
            sort_key="-start_date",
            count=1,
        )
        if mcd_check:
            discovered["MCD12Q2_061"] = mcd_check[0].data_links()[0].split("/")[-1]
        # VNP22Q2 (.h5) streams directly into h5netcdf without temporary disk extraction
        pheno_granules = earthaccess.search_data(
            short_name="VNP22Q2",
            bounding_box=bbox,
            sort_key="-start_date",
            count=1,
        )
        if pheno_granules:
            discovered["VNP22Q2_002"] = pheno_granules[0].data_links()[0].split("/")[-1]
        else:
            pheno_granules = mcd_check
            pheno_short_name = "MCD12Q2"
    except Exception as exc:
        cmr_warnings.append(f"CMR MCD12Q2/VNP22Q2 query note: {exc}")

    try:
        nd_granules = earthaccess.search_data(
            short_name="NASADEM_HGT",
            version="001",
            bounding_box=bbox,
            sort_key="-start_date",
            count=1,
        )
        if nd_granules:
            discovered["NASADEM_HGT_001"] = nd_granules[0].data_links()[0].split("/")[-1]
    except Exception as exc:
        cmr_warnings.append(f"CMR NASADEM_HGT query note: {exc}")

    username = os.environ.get("EARTHDATA_USERNAME", "").strip()
    password = os.environ.get("EARTHDATA_PASSWORD", "").strip()
    has_netrc = os.path.exists(os.path.expanduser("~/.netrc"))
    if (not username or not password or username.startswith("YOUR_")) and not has_netrc:
        return {
            "status": "credentials_required",
            "cmrReachable": len(discovered) > 0,
            "discoveredGranules": discovered,
            "message": (
                f"NASA Earthdata CMR reachable ({len(discovered)} latest granules discovered). "
                "Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD in server environment secrets to stream protected HDF5/NetCDF4 assets into xarray."
            ),
            "gridCrs": TARGET_CRS,
            "layers": {},
            **({"warnings": cmr_warnings} if cmr_warnings else {}),
        }

    result: dict[str, Any] = {
        "status": "ok",
        "authStrategy": "environment" if username else "netrc",
        "cmrReachable": len(discovered) > 0,
        "discoveredGranules": discovered,
        "gridCrs": TARGET_CRS,
        "layers": {},
        "warnings": list(cmr_warnings),
    }

    try:
        auth = earthaccess.login(strategy="environment" if username else "netrc")
        if not getattr(auth, "authenticated", False):
            result["status"] = "auth_failed"
            result["message"] = (
                f"NASA Earthdata CMR reachable ({len(discovered)} granules discovered), "
                "but Earthdata Login did not authenticate with the configured EARTHDATA_USERNAME / EARTHDATA_PASSWORD."
            )
            return result
    except Exception as exc:
        result["status"] = "auth_failed"
        result["message"] = (
            f"NASA Earthdata CMR reachable ({len(discovered)} granules discovered), "
            f"but Earthdata Login rejected the configured credentials: {exc}"
        )
        return result

    # 1. SMAP Level 4 Soil Moisture (SPL4SMGP v008: sm_surface, sm_rootzone)
    try:
        if smap_granules:
            files = earthaccess.open(smap_granules)
            with xr.open_dataset(files[0], group="Geophysical_Data", engine="h5netcdf") as ds_geo, \
                 xr.open_dataset(files[0], engine="h5netcdf") as ds_root:
                lat_arr = ds_root["cell_lat"].values if "cell_lat" in ds_root else None
                lon_arr = ds_root["cell_lon"].values if "cell_lon" in ds_root else None

                for var_name in ("sm_surface", "sm_rootzone"):
                    if var_name in ds_geo:
                        arr = ds_geo[var_name]
                        if "time" in arr.dims:
                            arr = arr.isel(time=0)
                        if lat_arr is not None and lon_arr is not None:
                            lat_1d = np.nanmean(lat_arr, axis=1)
                            lon_1d = np.nanmean(lon_arr, axis=0)
                            da = xr.DataArray(
                                np.asarray(arr.values, dtype=np.float32),
                                coords={"y": lat_1d, "x": lon_1d},
                                dims=("y", "x"),
                            ).where(lambda v: (v >= 0.0) & (v <= 1.0)).rio.write_crs(TARGET_CRS).rio.write_nodata(np.nan)
                            da_clip = da.rio.clip_box(
                                bbox[0] - 0.5, bbox[1] - 0.5, bbox[2] + 0.5, bbox[3] + 0.5,
                                allow_one_dimensional_raster=True,
                            )
                            aligned = align_to_unified_grid(
                                da_clip, template_grid, polygon_geojson
                            )
                            result["layers"][f"smap_{var_name}"] = summarize_layer(
                                aligned, "m3/m3", "SPL4SMGP v008"
                            )
        else:
            result["warnings"].append("No SPL4SMGP v008 granules found in last 60 days")
    except Exception as exc:
        result["warnings"].append(f"SMAP SPL4SMGP v008 error: {exc}")

    # 2. GPM IMERG (GPM_3IMERGDF / GPM_3IMERGDL)
    try:
        if gpm_granules:
            files = earthaccess.open(gpm_granules)
            with xr.open_dataset(files[0], group="Grid", engine="h5netcdf") as ds_gpm:
                p_var = "precipitation" if "precipitation" in ds_gpm else "precipitationCal"
                if p_var in ds_gpm:
                    da = ds_gpm[p_var]
                    if "time" in da.dims:
                        da = da.isel(time=0)
                    da = da.transpose("lat", "lon").rename({"lat": "y", "lon": "x"}).rio.write_crs(TARGET_CRS).rio.write_nodata(np.nan)
                    da_clip = da.rio.clip_box(
                        bbox[0] - 0.5, bbox[1] - 0.5, bbox[2] + 0.5, bbox[3] + 0.5,
                        allow_one_dimensional_raster=True,
                    )
                    aligned = align_to_unified_grid(da_clip, template_grid, polygon_geojson)
                    result["layers"]["earthdata_gpm_imerg_mm_day"] = summarize_layer(
                        aligned, "mm/day", gpm_short_name
                    )
        else:
            result["warnings"].append("No GPM_3IMERGDF / GPM_3IMERGDL granules found")
    except Exception as exc:
        result["warnings"].append(f"Earthdata GPM IMERG error: {exc}")

    # 3. MODIS / VIIRS Land Cover Dynamics (VNP22Q2 HDF5 / MCD12Q2)
    try:
        if pheno_granules:
            files = earthaccess.open(pheno_granules)
            with xr.open_dataset(files[0], engine="h5netcdf") as ds_pheno:
                g_key = next((k for k in ds_pheno.data_vars if "Greenup" in k or "Onset_Greenness_Increase" in k), None)
                d_key = next((k for k in ds_pheno.data_vars if "Dormancy" in k or "Onset_Greenness_Minimum" in k), None)
                if g_key and d_key:
                    gsl = (ds_pheno[d_key] - ds_pheno[g_key]).where(lambda x: (x > 15) & (x < 366))
                    if "NumCycles" in gsl.dims:
                        gsl = gsl.isel(NumCycles=0)
                    result["layers"]["earthdata_mcd12q2_gsl"] = summarize_layer(
                        gsl, "days", pheno_short_name
                    )
        else:
            result["warnings"].append("No MCD12Q2 / VNP22Q2 granules matched bounding box")
    except Exception as exc:
        result["warnings"].append(f"Earthdata phenology ({pheno_short_name}) error: {exc}")

    # 4. NASADEM (NASADEM_HGT zip -> MemoryFile -> rioxarray + xrspatial, zero disk writes)
    try:
        if nd_granules:
            files = earthaccess.open(nd_granules)
            raw_bytes = files[0].read()
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                hgt_name = next((n for n in zf.namelist() if n.lower().endswith((".hgt", ".tif"))), None)
                if hgt_name:
                    hgt_bytes = zf.read(hgt_name)
                    with MemoryFile(hgt_bytes, ext=os.path.splitext(hgt_name)[1]) as memfile:
                        dem_da = rioxarray.open_rasterio(memfile)
                        dem_clip = _clip_in_source_crs(dem_da, bbox, pad_fraction=0.4).load()
                        dem_2d = dem_clip.isel(band=0, drop=True) if "band" in dem_clip.dims else dem_clip
                        dem_2d = dem_2d.astype(np.float32).where(lambda d: d > -500).rio.write_nodata(np.nan)
                        utm_crs = _estimate_utm_epsg(lat, lon)
                        slope_utm = (
                            xrspatial_slope(dem_2d.rio.reproject(utm_crs, nodata=np.nan))
                            .where(lambda s: (s >= 0.0) & (s <= 90.0))
                            .rio.write_crs(utm_crs)
                            .rio.write_nodata(np.nan)
                        )
                        slope_aligned = align_to_unified_grid(slope_utm, template_grid, polygon_geojson)
                        result["layers"]["earthdata_nasadem_slope_deg"] = summarize_layer(
                            slope_aligned, "degrees", "NASADEM_HGT+xrspatial"
                        )
                else:
                    result["warnings"].append("NASADEM_HGT zip contained no .hgt or .tif raster")
        else:
            result["warnings"].append("No NASADEM_HGT granules matched bounding box")
    except Exception as exc:
        result["warnings"].append(f"Earthdata NASADEM error: {exc}")

    if not result["layers"] and result["warnings"]:
        result["status"] = "partial"
    return result


def ingest_isric_soilgrids(
    bbox: tuple[float, float, float, float],
    template_grid: xr.DataArray,
    polygon_geojson: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Stream global 250m SoilGrids v2.0 properties (phh2o, soc, clay, sand at 0-5cm)
    directly over HTTP via GDAL Virtual Rasters (/vsicurl/ ... .vrt) and apply the
    standard / 10.0 scaling factor.
    """
    layers_spec = [
        ("phh2o", "phh2o_0-5cm_mean.vrt", "pH", "soil_ph"),
        ("soc", "soc_0-5cm_mean.vrt", "g/kg", "soil_organic_carbon_g_kg"),
        ("clay", "clay_0-5cm_mean.vrt", "%", "soil_clay_pct"),
        ("sand", "sand_0-5cm_mean.vrt", "%", "soil_sand_pct"),
    ]

    result: dict[str, Any] = {
        "status": "ok",
        "vrtBase": SOILGRIDS_VRT_BASE,
        "gridCrs": TARGET_CRS,
        "scalingFactor": "/ 10.0",
        "layers": {},
        "warnings": [],
    }

    def _fetch_one(spec: tuple[str, str, str, str]) -> tuple[str, dict[str, Any] | None, str | None]:
        prop, vrt_file, units, out_key = spec
        vrt_url = f"{SOILGRIDS_VRT_BASE}/{prop}/{vrt_file}"
        try:
            da = rioxarray.open_rasterio(vrt_url)
            da_clip = _clip_in_source_crs(da, bbox, pad_fraction=0.35).load()
            if "band" in da_clip.dims:
                da_clip = da_clip.isel(band=0, drop=True)

            nodata = da_clip.rio.nodata
            valid = da_clip.where(da_clip > 0)
            if nodata is not None:
                valid = valid.where(da_clip != nodata)

            scaled = (valid / 10.0).astype(np.float32)
            scaled = scaled.rio.write_crs(da_clip.rio.crs)
            aligned = align_to_unified_grid(scaled, template_grid, polygon_geojson)
            return out_key, summarize_layer(aligned, units, f"isric_soilgrids:{vrt_file}"), None
        except Exception as exc:
            return out_key, None, f"{prop} VRT stream error: {exc}"

    # Stream sequentially to avoid GDAL /vsicurl/ connection contention
    for spec in layers_spec:
        out_key, summary, err = _fetch_one(spec)
        if summary is not None:
            result["layers"][out_key] = summary
        if err:
            result["warnings"].append(err)

    if not result["layers"]:
        result["status"] = "unavailable"
    elif result["warnings"]:
        result["status"] = "partial"
    return result


def run_ingestion(
    lat: float,
    lon: float,
    bbox: list[float] | None = None,
    polygon_geojson: dict[str, Any] | None = None,
    sources: list[str] | None = None,
) -> dict[str, Any]:
    target_bbox = normalize_bbox(lat, lon, bbox)
    template_grid = build_unified_grid(target_bbox, width=24, height=24)
    requested = set(sources or ["planetary_computer", "earthdata", "soilgrids"])

    payload: dict[str, Any] = {
        "ingestedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "location": {"lat": lat, "lon": lon},
        "unifiedGrid": {
            "crs": TARGET_CRS,
            "bbox": list(target_bbox),
            "shape": [24, 24],
        },
        "sources": {},
    }

    def _run_pc() -> dict[str, Any]:
        try:
            return ingest_planetary_computer(
                lat, lon, target_bbox, template_grid, polygon_geojson
            )
        except Exception as exc:
            return {
                "status": "error",
                "error": str(exc),
                "trace": traceback.format_exc(limit=3),
                "layers": {},
            }

    def _run_ed() -> dict[str, Any]:
        try:
            return ingest_nasa_earthdata(
                lat, lon, target_bbox, template_grid, polygon_geojson
            )
        except Exception as exc:
            return {
                "status": "error",
                "error": str(exc),
                "layers": {},
            }

    def _run_sg() -> dict[str, Any]:
        try:
            return ingest_isric_soilgrids(
                target_bbox, template_grid, polygon_geojson
            )
        except Exception as exc:
            return {
                "status": "error",
                "error": str(exc),
                "layers": {},
            }

    futures: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        if "planetary_computer" in requested:
            futures["planetaryComputer"] = pool.submit(_run_pc)
        if "earthdata" in requested:
            futures["nasaEarthdata"] = pool.submit(_run_ed)
        if "soilgrids" in requested:
            futures["isricSoilGrids"] = pool.submit(_run_sg)

        for key, fut in futures.items():
            payload["sources"][key] = fut.result()

    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="CropNext geospatial xarray ingestion")
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--bbox", type=str, default=None, help="JSON [minx,miny,maxx,maxy]")
    parser.add_argument("--polygon", type=str, default=None, help="JSON GeoJSON geometry")
    parser.add_argument("--sources", type=str, default=None, help="Comma-separated sources")
    args = parser.parse_args()

    bbox = json.loads(args.bbox) if args.bbox else None
    polygon = json.loads(args.polygon) if args.polygon else None
    sources = [s.strip() for s in args.sources.split(",")] if args.sources else None

    result = run_ingestion(
        lat=args.lat,
        lon=args.lon,
        bbox=bbox,
        polygon_geojson=polygon,
        sources=sources,
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
