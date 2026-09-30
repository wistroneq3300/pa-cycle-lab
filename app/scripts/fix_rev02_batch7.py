# Precise per-(sheet,row) ai_commands fix for Round-02 batch 7 (Functionality rows 1203-1402, item 1201-1400).
#
# Classes fixed (all ai_commands col15; no verdict change this batch):
#  R29   : bare ipmitool DCMI subcommand missing the `ipmitool` keyword inside DUT-ssh -> `sudo ipmitool dcmi ...`.
#  WR    : non-existent DCMI subcommand names -> real ones (capabilities->discover, getoobconf->get_conf_param,
#          setoobconf->set_conf_param/set_mc_id_string, mc_id_string_privilege->get_mc_id_string,
#          activate_limit->activate, thermal get_temp->get_temp_reading).
#  R5    : Redfish curl (agent-host BMC access) wrongly wrapped in DUT-ssh with broken nested double-quotes
#          -> move to agent-host one-liner.
#  WR/R5 : Chassis/Redfish GET rows mislabeled "not directly runnable ... IPMI bytes" where the procedure gives a
#          clear Redfish curl -> replace with real agent-host curl (+ ${...:?} vendor slots where an instance id is needed).
#
# Pure ASCII only in this script. Uses python-openpyxl.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'

AUTH = '-u "$BMC_USER:$BMC_PASS"'
HDR = '-H "Content-Type: application/json"'
def rf(path):
    return f'curl -s -k {AUTH} {HDR} -X GET https://$BMC_IP{path} | jq'

FIX = {
# ==================== DCMI block ====================
# --- R29 (missing ipmitool keyword) + WR (non-existent subcommand) on IB rows ---
1256: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi discover 2>&1"''',
1258: r'''-- Set DCMI Configuration Parameters (IB): set DCMI config on the DUT (e.g. activate DHCP); agent runs on DUT, then re-reads to confirm.
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi set_conf_param ${DCMI_PARAM:?operator must set the DCMI config parameter, e.g. activate_dhcp} 2>&1; sudo ipmitool dcmi get_conf_param 2>&1"''',
1260: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi get_conf_param 2>&1"''',
1262: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi get_mc_id_string 2>&1"''',
1264: r'''-- Set Management Controller Identifier String (IB): set the MC ID string on the DUT; agent sets it, then re-reads to confirm.
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi set_mc_id_string ${MC_ID_STRING:?operator must set the new management controller identifier string} 2>&1; sudo ipmitool dcmi get_mc_id_string 2>&1"''',
1266: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi asset_tag 2>&1"''',
1268: r'''-- Set Asset Tag (IB): set the asset tag on the DUT; agent sets it, then re-reads to confirm.
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi set_asset_tag ${ASSET_TAG:?operator must set the new asset tag} 2>&1; sudo ipmitool dcmi asset_tag 2>&1"''',
1270: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi sensors 2>&1"''',
1272: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi power reading 2>&1"''',
1274: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi power get_limit 2>&1"''',
1276: r'''-- Set Power Limit (IB): set DCMI power limit on the DUT; agent sets the operator-supplied watt, then re-reads.
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi power set_limit limit ${POWER_LIMIT_WATT:?operator must set the power limit in watts} 2>&1; sleep 3; sudo ipmitool dcmi power get_limit 2>&1"''',
1278: r'''-- Activate Power Limit (IB): activate the set power limit on the DUT; agent activates then re-reads the limit.
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi power activate 2>&1; sleep 3; sudo ipmitool dcmi power get_limit 2>&1"''',
1284: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool dcmi get_temp_reading ${DCMI_ENTITY_ID:?operator must set the DCMI entity id (e.g. 0x44 for processor)} ${DCMI_ENTITY_INSTANCE:?operator must set the entity instance (e.g. 0)} 2>&1"''',
# --- WR (non-existent subcommand) on OOB rows (already have ipmitool, only subcommand fix) ---
1257: r'''ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi discover 2>&1''',
1259: r'''-- Set DCMI Configuration Parameters (OOB): set DCMI config via OOB; agent sets the operator-supplied param, then re-reads.
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi set_conf_param ${DCMI_PARAM:?operator must set the DCMI config parameter, e.g. activate_dhcp} 2>&1
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi get_conf_param 2>&1''',
1261: r'''ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi get_conf_param 2>&1''',
1263: r'''ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi get_mc_id_string 2>&1''',
1265: r'''-- Set Management Controller Identifier String (OOB): set MC ID string via OOB; agent sets it, then re-reads.
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi set_mc_id_string ${MC_ID_STRING:?operator must set the new management controller identifier string} 2>&1
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi get_mc_id_string 2>&1''',
1277: r'''-- Set Power Limit (OOB): set DCMI power limit via OOB; agent sets the operator-supplied watt, then re-reads.
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi power set_limit limit ${POWER_LIMIT_WATT:?operator must set the power limit in watts} 2>&1
sleep 3
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi power get_limit 2>&1''',
1279: r'''-- Activate Power Limit (OOB): activate the set power limit via OOB; agent activates then re-reads.
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi power activate 2>&1
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi power get_limit 2>&1''',
1285: r'''ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" dcmi get_temp_reading ${DCMI_ENTITY_ID:?operator must set the DCMI entity id (e.g. 0x44 for processor)} ${DCMI_ENTITY_INSTANCE:?operator must set the entity instance (e.g. 0)} 2>&1''',

# ==================== R5: Redfish curl wrongly wrapped in DUT-ssh (broken nested quotes) -> agent-host ====================
1286: r'''-- Get Redfish Service root: GET the ServiceRoot and enumerate it.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1 | jq -r '.RedfishVersion,.Systems,.Managers' ''',
1296: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/SessionService/Sessions/${SESSION_ID:?operator must set the session id from the Sessions collection} | jq -r '.UserName,.ClientOriginIPAddress' ''',
1297: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/SessionService/Sessions | jq -r '.Members[].Id' ''',
1298: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/SessionService/Sessions/${SESSION_ID:?operator must set the session id from the Sessions collection} | jq -r '.UserName,.ClientOriginIPAddress' ''',
1323: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Systems/system/Storage | jq .''',
1324: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Systems/system/Storage/${STORAGE_ID:?operator must set the Storage collection member id from the Storage collection listing} | jq .''',
1325: r'''-- Get Redfish Storage Inventory (all connected storage devices): enumerate all controllers/drives under Storage.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Systems/system/Storage | jq .''',
1332: rf('/redfish/v1/Systems/system/Bios'),
1333: r'''-- PATCH Redfish Bios: PATCH the Bios attributes with the exact attribute/value the operator supplies, then re-GET to confirm.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X PATCH https://$BMC_IP/redfish/v1/Systems/system/Bios -d '{"Attributes":{"${BIOS_ATTR:?operator must set the BIOS attribute name}":"${BIOS_ATTR_VALUE:?operator must set the BIOS attribute value}"}}' -w "\\nHTTP %{http_code}\\n"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Systems/system/Bios | jq .''',
1334: rf('/redfish/v1/Systems/system/Bios/SD'),
1335: rf('/redfish/v1/Systems/system/Bios/Actions/Bios.ResetBios'),
1365: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/AccountService/Accounts/${ACCOUNT_ID:?operator must set the account id from the Accounts collection}/Certificates/${CERT_ID:?operator must set the certificate id} | jq .''',
1366: r'''-- Redfish Accounts Creation: POST a new account with the operator-supplied name/password/role, then verify via GET.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST https://$BMC_IP/redfish/v1/AccountService/Accounts -d '{"UserName":"${NEW_ACCOUNT_NAME:?operator must set the new Redfish account name}","Password":"${NEW_ACCOUNT_PASS:?operator must set the new Redfish account password}","RoleId":"Administrator"}' -w "\\nHTTP %{http_code}\\n"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/AccountService/Accounts | jq .''',
1367: r'''-- POST Role Creation/Deletion: create a Role with the operator-supplied id + privileges, verify via GET, then delete it.
RID="${ROLE_ID:?operator must set the new role id}"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST https://$BMC_IP/redfish/v1/AccountService/Roles -d "{\"Id\":\"$RID\",\"Privileges\":[\"${ROLE_PRIVILEGES:?operator must set the role privileges, e.g. Login}\"]}" -w "\\nHTTP %{http_code}\\n"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/AccountService/Roles | jq .
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X DELETE https://$BMC_IP/redfish/v1/AccountService/Roles/$RID -w "\\nHTTP %{http_code}\\n"''',
1368: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/AccountService/ActiveDirectory/Certificates/${CERT_ID:?operator must set the certificate id} | jq .''',
1369: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/AccountService/LDAP/Certificates/${CERT_ID:?operator must set the certificate id} | jq .''',
1370: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/TelemetryService | jq -r '.Id,.Status.State' ''',
1371: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/TelemetryService/MetricReports | jq -r '.Members[].Id'
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/TelemetryService/MetricReportDefinitions | jq -r '.Members[].Id' ''',
1372: r'''-- POST TelemetryService SubmitTestMetricReport: submit a test report for the operator-supplied definition, then verify a report appears.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST https://$BMC_IP/redfish/v1/TelemetryService/Actions/TelemetryService.SubmitTestMetricReport -d '{"MetricReportDefinitionName":"${METRIC_REPORT_DEF:?operator must set the Telemetry MetricReportDefinition name}"}' -w "\\nHTTP %{http_code}\\n"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/TelemetryService/MetricReports | jq -r '.Members[].Id' ''',
1373: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/UpdateService | jq -r '.ServiceEnabled,.FirmwareInventory' ''',
1374: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/UpdateService/FirmwareInventory | jq -r '.Members[].Id' ''',
1375: r'''-- FirmwareInventory version display naming: list each member + Version to cross-check against release note / webUI naming.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/UpdateService/FirmwareInventory | jq -r '.Members[].Id' | while read id; do curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/UpdateService/FirmwareInventory/$id | jq -c '{Name,Version}'; done''',
1377: r'''curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/EventService | jq -r '.ServiceEnabled,.DeliveryRetryAttempts,.EventTypesForSubscription' ''',
1378: r'''-- EventService Create Event: POST a subscription to the operator-supplied listener URL, then verify it appears.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST https://$BMC_IP/redfish/v1/EventService/Subscriptions -d '{"Destination":"${EVENT_LISTENER_URL:?operator must set the event listener destination URL}","EventTypes":["Alert"],"Protocol":"Redfish"}' -w "\\nHTTP %{http_code}\\n"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/EventService/Subscriptions | jq .''',
1379: r'''-- EventService Delete Event: DELETE the operator-supplied subscription id, then verify it is gone.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X DELETE https://$BMC_IP/redfish/v1/EventService/Subscriptions/${SUBSCRIPTION_ID:?operator must set the subscription id to delete} -w "\\nHTTP %{http_code}\\n"''',
1380: r'''-- BMC Cold-Reset: POST Manager.Reset ColdReset (state-changing, restarts BMC); confirm the action is accepted, agent does not wait for reboot.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST https://$BMC_IP/redfish/v1/Managers/bmc/Actions/Manager.Reset -d '{"ResetType":"ColdReset"}' -w "\\nHTTP %{http_code}\\n"''',

# ==================== WR/R5: Chassis/Redfish GET mislabeled "not directly runnable (IPMI bytes)" -> real agent-host curl ====================
1299: rf('/redfish/v1/Chassis'),
1300: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id from the Chassis collection}'),
1301: r'''curl -s -i -k -u "$BMC_USER:$BMC_PASS" -X GET https://$BMC_IP/redfish/v1/Chassis/UBB/Sensors 2>&1''',
1302: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Actions/Chassis.Reset'),
1303: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Power/Actions/Power.PowerSupplyReset'),
1304: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Assembly'),
1305: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Power/PowerSupplies/${PSU_ID:?operator must set the PowerSupply id}/Assembly'),
1306: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Thermal'),
1307: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/LED'),
1308: r'''-- PATCH Redfish LED: patch the LED state with the operator-supplied value, then re-GET to confirm.
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X PATCH https://$BMC_IP/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/LED -d '{"IndicatorLED":"${LED_STATE:?operator must set the LED state (Lit/Blinking/Off)}"}' -w "\\nHTTP %{http_code}\\n"
curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/LED | jq .''',
1309: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Power'),
1310: rf('/redfish/v1/Chassis/${CHASSIS_ID:?operator must set the Chassis instance id}/Thermal/Fans/${FAN_ID:?operator must set the Fan id}/Assembly'),
1311: rf('/redfish/v1/Managers/${MANAGER:?operator must set the Manager instance id, e.g. bmc}/LogServices/${LOGS:?operator must set the LogService instance id}/Entries'),
}

wb = openpyxl.load_workbook(XLSX)
ws = wb[SHEET]
changed = 0
missing = []
for rownum, newcmd in FIX.items():
    code = ws.cell(row=rownum, column=1).value
    if code is None:
        missing.append(rownum)
        continue
    ws.cell(row=rownum, column=15, value=newcmd)
    changed += 1
if missing:
    print('MISSING rows:', missing)
print('changed', changed, 'of', len(FIX), 'on sheet', SHEET)
if changed != len(FIX):
    sys.exit('ERROR: not all rows updated')
wb.save(XLSX)
print('saved', XLSX)
