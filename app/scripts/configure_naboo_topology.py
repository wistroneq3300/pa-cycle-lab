#!/usr/bin/env python3
"""Build the confirmed Naboo Vera management topology without exposing credentials."""
import argparse
import copy
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))
import topology_policy


IP_FIELDS = ("host_os", "host_bmc", "dpu_os", "dpu_bmc")


def natural_key(value):
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", value)]


def build_topology(data, project_name="Naboo"):
    projects = data.get("projects", {})
    machines = data.get("machines", {})
    if project_name not in projects:
        raise ValueError(f"找不到專案：{project_name}")

    servers = sorted((name for name, machine in machines.items()
                      if machine.get("project") == project_name
                      and machine.get("level") == "rack"
                      and machine.get("mgx_type") == "server"), key=natural_key)
    switches = sorted((name for name, machine in machines.items()
                       if machine.get("project") == project_name
                       and machine.get("level") == "rack"
                       and machine.get("mgx_type") == "switch"), key=natural_key)
    power_shelves = sorted((name for name, machine in machines.items()
                            if machine.get("project") == project_name
                            and machine.get("level") == "rack"
                            and machine.get("mgx_type") == "powershelf"), key=natural_key)
    cdus = sorted((name for name, machine in machines.items()
                   if machine.get("project") == project_name
                   and machine.get("level") == "rack"
                   and machine.get("mgx_type") == "cdu"), key=natural_key)
    if len(servers) != 32 or len(switches) != 2 or len(power_shelves) != 3 or len(cdus) != 1:
        raise ValueError(
            "Naboo 預期為 32 台伺服器、2 台交換器、3 台 Power Shelf 與 1 台 CDU，"
            f"目前為 {len(servers)}／{len(switches)}／{len(power_shelves)}／{len(cdus)}"
        )

    current = projects[project_name].get("topology") or {"revision": 0, "racks": []}
    old_nodes = {}
    for old_rack in current.get("racks", []):
        for device in old_rack.get("devices", []):
            key = (device.get("inventory") or device.get("name", "")).casefold()
            for index, node in enumerate(device.get("nodes", []), 1):
                old_nodes[(key, index)] = {field: node.get(field, "") for field in IP_FIELDS}

    previous_rack = current.get("racks", [{}])[0] if current.get("racks") else {}
    rack = {"id": previous_rack.get("id") or "naboo-rack",
            "name": previous_rack.get("name") or "Naboo Rack", "devices": [], "links": []}

    for switch_index, name in enumerate(switches, 1):
        ports = []
        for port_number in range(1, 49):
            role = "host" if switch_index == 1 and port_number <= 32 else \
                   "dpu" if switch_index == 2 and port_number <= 32 else \
                   "power" if switch_index == 1 and 33 <= port_number <= 35 else \
                   "cooling" if switch_index == 1 and port_number == 36 else \
                   "uplink" if port_number == 48 else "other"
            ports.append({"id": f"sw{switch_index}-p{port_number}", "name": str(port_number),
                          "role": role, "nodes": []})
        rack["devices"].append({"id": f"naboo-switch-{switch_index}", "name": name,
                                "kind": "switch", "inventory": name, "nodes": [], "ports": ports})

    for server_index, name in enumerate(servers, 1):
        nodes = []
        node_ids = []
        for node_index in range(1, 5):
            node_id = f"naboo-{server_index:02d}-node-{node_index}"
            node = {"id": node_id, "name": f"節點 {node_index}", "bf4": f"BF4 #{node_index}",
                    **{field: "" for field in IP_FIELDS}}
            node.update(old_nodes.get((name.casefold(), node_index), {}))
            nodes.append(node); node_ids.append(node_id)
        rack["devices"].append({
            "id": f"naboo-server-{server_index:02d}", "name": name, "kind": "server",
            "inventory": name, "nodes": nodes,
            "ports": [
                {"id": f"naboo-{server_index:02d}-host", "name": "RJ45 #1",
                 "role": "host", "nodes": node_ids[:]},
                {"id": f"naboo-{server_index:02d}-dpu", "name": "RJ45 #2",
                 "role": "dpu", "nodes": node_ids[:]},
            ],
        })
        rack["links"].extend([
            {"id": f"naboo-host-{server_index:02d}",
             "a": {"device": "naboo-switch-1", "port": f"sw1-p{server_index}"},
             "b": {"device": f"naboo-server-{server_index:02d}", "port": f"naboo-{server_index:02d}-host"},
             "network": "host", "state": "confirmed", "note": f"{name} 主機管理"},
            {"id": f"naboo-dpu-{server_index:02d}",
             "a": {"device": "naboo-switch-2", "port": f"sw2-p{server_index}"},
             "b": {"device": f"naboo-server-{server_index:02d}", "port": f"naboo-{server_index:02d}-dpu"},
             "network": "dpu", "state": "confirmed", "note": f"{name} DPU 管理"},
        ])
    rack["links"].append({
        "id": "naboo-switch-interconnect",
        "a": {"device": "naboo-switch-1", "port": "sw1-p48"},
        "b": {"device": "naboo-switch-2", "port": "sw2-p48"},
        "network": "uplink", "state": "confirmed", "note": "交換器互連",
    })

    for shelf_index, name in enumerate(power_shelves, 1):
        device_id = f"naboo-power-shelf-{shelf_index}"
        port_id = f"naboo-power-shelf-{shelf_index}-management"
        rack["devices"].append({
            "id": device_id, "name": name, "kind": "other", "inventory": name,
            "nodes": [], "ports": [{"id": port_id, "name": "管理埠",
                                      "role": "power", "nodes": []}],
        })
        rack["links"].append({
            "id": f"naboo-power-{shelf_index}",
            "a": {"device": "naboo-switch-1", "port": f"sw1-p{32 + shelf_index}"},
            "b": {"device": device_id, "port": port_id},
            "network": "power", "state": "confirmed", "note": f"{name} 管理網路",
        })

    cdu_name = cdus[0]
    rack["devices"].append({
        "id": "naboo-cdu-1", "name": cdu_name, "kind": "other", "inventory": cdu_name,
        "nodes": [], "ports": [{"id": "naboo-cdu-1-management", "name": "管理埠",
                                  "role": "cooling", "nodes": []}],
    })
    rack["links"].append({
        "id": "naboo-cooling-1",
        "a": {"device": "naboo-switch-1", "port": "sw1-p36"},
        "b": {"device": "naboo-cdu-1", "port": "naboo-cdu-1-management"},
        "network": "cooling", "state": "confirmed", "note": f"{cdu_name} 管理網路",
    })

    validated = topology_policy.validate({"racks": [rack]})
    validated["revision"] = int(current.get("revision", 0)) + 1
    return validated


def write_atomic(path, data, backup=True):
    if backup:
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(path, path.with_name(f"{path.name}.bak-{stamp}"))
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write("\n"); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description="建立 Naboo 32×4 節點的已確認管理網路拓樸")
    parser.add_argument("data_file", type=Path)
    parser.add_argument("--no-backup", action="store_true")
    args = parser.parse_args()
    path = args.data_file.resolve()
    with path.open(encoding="utf-8") as stream:
        data = json.load(stream)
    topology = build_topology(copy.deepcopy(data))
    data["projects"]["Naboo"]["topology"] = topology
    write_atomic(path, data, backup=not args.no_backup)
    print(f"Naboo topology configured: 38 devices, 128 nodes, 69 confirmed links, revision {topology['revision']}")


if __name__ == "__main__":
    main()
