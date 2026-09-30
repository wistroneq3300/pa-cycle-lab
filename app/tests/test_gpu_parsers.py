# -*- coding: utf-8 -*-
"""GPU 收集解析測試：NVIDIA(nvidia-smi CSV) 與 AMD(rocm-smi section) 都要能解析，
且欄位結構一致（供同一套 gpu_metrics 表與前端圖表使用）。"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import telemetry_core as tc


def test_parse_gpu_nvidia():
    nv = ("0, NVIDIA H100 SXM, 12, 81559, 1024, 55, 500.00, 700.00\n"
          "1, NVIDIA H100 SXM, 8, 81559, 2048, 60, 480.00, 700.00")
    rows = tc.parse_gpu(nv)
    assert len(rows) == 2
    assert rows[0]["gpu"] == 0
    assert rows[0]["name"] == "NVIDIA H100 SXM"
    assert rows[0]["util"] == 12.0
    assert rows[0]["mem_total"] == 81559 / 1024       # MiB -> GiB
    assert rows[0]["mem_used"] == 1024 / 1024
    assert rows[0]["temp"] == 55.0
    assert rows[0]["power"] == 500.0
    assert rows[0]["power_limit"] == 700.0
    # 兩支 parser 回傳的欄位集要一致（前端圖表靠這幾個 key）
    assert set(rows[0]) == {"gpu", "name", "util", "mem_total",
                            "mem_used", "temp", "power", "power_limit"}


def test_parse_gpu_nvidia_empty():
    assert tc.parse_gpu("") == []
    assert tc.parse_gpu(None) == []
    # 欄位數不足 8 的行要跳過
    assert tc.parse_gpu("0, NVIDIA H100") == []


def test_parse_amdgpu_basic():
    # 真實 rocm-smi（ROCm 5.x/6.x）格式：GPU[n] : <label>: <value>，記憶體單位 bytes。
    # 取自 node_h（8x MI300X OAM）實抓輸出。
    amd = (
        "GPU[0]          : Card Series:          AMD Instinct MI300X OAM\n"
        "GPU[0]          : Card Vendor:          Advanced Micro Devices, Inc. [AMD/ATI]\n"
        "GPU[1]          : Card Series:          AMD Instinct MI300X OAM\n"
        "GPU[0]          : GPU use (%): 0\n"
        "GPU[1]          : GPU use (%): 12\n"
        "GPU[0]          : VRAM Total Memory (B): 206141652992\n"
        "GPU[1]          : VRAM Total Memory (B): 206141652992\n"
        "GPU[0]          : VRAM Total Used Memory (B): 297771008\n"
        "GPU[1]          : VRAM Total Used Memory (B): 33285996544\n"
        "GPU[0]          : Temperature (Sensor junction) (C): 53.0\n"
        "GPU[0]          : Temperature (Sensor memory) (C): 49.0\n"
        "GPU[1]          : Temperature (Sensor junction) (C): 55.0\n"
        "GPU[0]          : Current Socket Graphics Package Power (W): 152.0\n"
        "GPU[1]          : Current Socket Graphics Package Power (W): 320.0\n"
    )
    rows = tc.parse_amdgpu(amd)
    assert len(rows) == 2
    r0, r1 = rows[0], rows[1]
    assert r0["gpu"] == 0 and r1["gpu"] == 1
    assert r0["name"] == "AMD Instinct MI300X OAM"
    assert r0["util"] == 0.0
    assert r1["util"] == 12.0
    # 記憶體 bytes -> GiB
    assert abs(r0["mem_total"] - 206141652992 / (1024 ** 3)) < 1e-6
    assert abs(r0["mem_used"] - 297771008 / (1024 ** 3)) < 1e-6
    # 溫度多 sensor 取最大
    assert r0["temp"] == 53.0
    assert r1["temp"] == 55.0
    assert r0["power"] == 152.0 and r1["power"] == 320.0
    assert rows[0]["power_limit"] is None
    # 欄位結構與 NVIDIA 對齊
    assert set(r0) == {"gpu", "name", "util", "mem_total",
                       "mem_used", "temp", "power", "power_limit"}


def test_parse_amdgpu_missing_temp_power():
    # 只有 VRAM / utilization，沒有 temp/power → 該欄為 None但不崩潰
    amd = (
        "GPU[0]          : Card Series:          AMD Instinct MI250\n"
        "GPU[0]          : GPU use (%): 42\n"
        "GPU[0]          : VRAM Total Memory (B): 171798691840\n"
    )
    rows = tc.parse_amdgpu(amd)
    assert len(rows) == 1
    assert rows[0]["name"] == "AMD Instinct MI250"
    assert rows[0]["util"] == 42.0
    assert abs(rows[0]["mem_total"] - 171798691840 / (1024 ** 3)) < 1e-6
    assert rows[0]["temp"] is None
    assert rows[0]["power"] is None


def test_parse_amdgpu_empty():
    assert tc.parse_amdgpu("") == []
    assert tc.parse_amdgpu(None) == []
    # 只有名稱沒有數值行 → 空
    assert tc.parse_amdgpu("GPU[0] : Card Series: AMD Instinct MI300X OAM") == []


def test_nvidia_and_amd_shape_match():
    """同一張卡的欄位 key 集合兩者都要一致，前端圖表才能通用。"""
    nv = tc.parse_gpu("0, NVIDIA H100 SXM, 12, 81559, 1024, 55, 500.00, 700.00")[0]
    amd = tc.parse_amdgpu(
        "GPU[0] : GPU use (%): 12\n"
        "GPU[0] : Temperature (Sensor junction) (C): 41\n"
    )[0]
    assert set(nv) == set(amd)
