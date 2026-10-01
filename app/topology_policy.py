"""Validated, project-local topology documents. No device operations or credentials."""
import copy
import ipaddress


NETWORK_ROLES = ('host', 'dpu', 'data', 'uplink', 'power', 'cooling', 'other')


def validate(document):
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def text(value, label, required=True):
        require(isinstance(value, str) and len(value) <= 160, label + '：文字格式不正確')
        require(not required or bool(value.strip()), label + '：必填')
        return value

    def items(obj, key, limit):
        value = obj.get(key)
        require(isinstance(value, list) and len(value) <= limit, key + '：清單格式不正確或超過數量限制')
        require(all(isinstance(v, dict) for v in value), key + '：項目格式不正確')
        return value

    def unique(entries, label):
        ids = [text(e.get('id'), label + ' ID') for e in entries]
        require(len(ids) == len(set(ids)), label + '：ID 重複')

    require(isinstance(document, dict), '拓樸資料格式不正確')
    result = {'racks': []}
    racks = items(document, 'racks', 32)
    unique(racks, '機櫃')
    for rack in racks:
        out = {'id': rack['id'], 'name': text(rack.get('name'), '機櫃名稱'), 'devices': [], 'links': []}
        devices = items(rack, 'devices', 256)
        unique(devices, '設備')
        endpoints = set()
        for device in devices:
            d = {k: text(device.get(k, ''), k, k in ('id', 'name', 'kind'))
                 for k in ('id', 'name', 'kind', 'inventory')}
            require(d['kind'] in ('server', 'switch', 'other'), '設備類型不正確')
            nodes = items(device, 'nodes', 64)
            ports = items(device, 'ports', 256)
            unique(nodes, '節點')
            unique(ports, '連接埠')
            d.update(nodes=[], ports=[])
            node_ids = {n['id'] for n in nodes}
            for node in nodes:
                n = {'id': node['id'], 'name': text(node.get('name'), '節點名稱'),
                     'bf4': text(node.get('bf4', ''), 'DPU 標籤', False)}
                for key in ('host_os', 'host_bmc', 'dpu_os', 'dpu_bmc'):
                    value = text(node.get(key, ''), key, False)
                    if value:
                        try:
                            ipaddress.ip_address(value)
                        except ValueError:
                            raise ValueError(key + '：IP 位址格式不正確') from None
                    n[key] = value
                d['nodes'].append(n)
            for port in ports:
                p = {'id': port['id'], 'name': text(port.get('name'), '連接埠名稱'),
                     'role': text(port.get('role'), '連接埠用途')}
                require(p['role'] in NETWORK_ROLES, '連接埠用途不正確')
                refs = port.get('nodes', [])
                require(isinstance(refs, list) and all(isinstance(x, str) and x in node_ids for x in refs), '連接埠指向不存在的節點')
                require(len(refs) == len(set(refs)), '節點對應重複')
                p['nodes'] = refs[:]
                d['ports'].append(p)
                endpoints.add((d['id'], p['id']))
            require(len({p['name'] for p in ports}) == len(ports), '同一設備的連接埠名稱不可重複')
            out['devices'].append(d)
        connections = items(rack, 'links', 2048)
        unique(connections, '線路')
        used = set()
        for link in connections:
            line = {'id': link['id'], 'note': text(link.get('note', ''), '備註', False),
                    'state': text(link.get('state'), '連線狀態'),
                    'network': text(link.get('network'), '網路類型')}
            require(line['state'] in ('planned', 'confirmed'), '連線狀態不正確')
            require(line['network'] in NETWORK_ROLES, '網路類型不正確')
            for side in ('a', 'b'):
                endpoint = link.get(side)
                require(isinstance(endpoint, dict), '缺少線路端點')
                pair = (text(endpoint.get('device'), '設備 ID'), text(endpoint.get('port'), '連接埠 ID'))
                require(pair in endpoints, '線路指向不存在的設備或連接埠')
                require(pair not in used, '實體連接埠已經接線')
                used.add(pair)
                line[side] = dict(device=pair[0], port=pair[1])
            require(line['a']['device'] != line['b']['device'], '設備不能連接到自己')
            out['links'].append(line)
        result['racks'].append(out)
    return copy.deepcopy(result)
