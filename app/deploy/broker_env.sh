export SPX_KVM_TARGETS='[{"server_id":"bmc-internal-a","bmc_subdomain":"bmc-bmc-internal-a.kvm.lab.example.internal","upstream_ip":"INTERNAL_IP_2","kvm_operator_cred_name":"spx:bmc-internal-a:kvm-operator"}]'
export SPX_SECRET_FILE=/etc/portal/secrets/spx-bmc-credentials.age
export SPX_IDENTITY_FILE=/etc/portal/secrets/spx-bmc-identity.txt
export SPX_REGISTRY_DB=/tmp/spx-broker-registry.db
export SPX_AUDIT_LOG=/tmp/spx-broker-audit.log

# Auth provider for /api/kvm/launch.
#   noauth   = fail-closed (deny all) — default, and what must ship in prod
#   operator = Stage-1 bootstrap: fixed operator from SPX_OPERATOR_ID /
#              SPX_OPERATOR_ROLES (never trusted from the request). Use ONLY to
#              exercise the live handoff before real Portal login/RBAC exists.
#   <mod>:<fn> = future real Portal auth provider (see rbac.PortalAuth).
export SPX_PORTAL_AUTH=noauth
export SPX_OPERATOR_ID=op1   # used only when SPX_PORTAL_AUTH=operator
export SPX_OPERATOR_ROLES=operator
