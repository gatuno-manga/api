#!/bin/bash
set -e

# Dynamically generate ProxySQL config using environment variables
cat <<EOF > /etc/proxysql.cnf
datadir="/var/lib/proxysql"

admin_variables=
{
    admin_credentials="admin:admin"
    mysql_ifaces="0.0.0.0:6032"
}

mysql_variables=
{
    threads=4
    max_connections=2048
    default_query_delay=0
    default_query_timeout=36000000
    have_compress=true
    poll_timeout=2000
    interfaces="0.0.0.0:6033"
    default_schema="information_schema"
    stacksize=1048576
    server_version="8.4.0"
    connect_timeout_server=10000
    monitor_username="${DB_USER:-gatuno_user}"
    monitor_password="${DB_PASS:-gatuno_pass}"
    monitor_history=600000
    monitor_connect_interval=200000
    monitor_ping_interval=200000
    monitor_read_only_interval=1500
    monitor_read_only_timeout=500
}

mysql_servers =
(
    { address="database-master" , port=3306 , hostgroup=1 , max_connections=200 },
    { address="database-slave-1" , port=3306 , hostgroup=2 , max_connections=200 },
    { address="database-slave-2" , port=3306 , hostgroup=2 , max_connections=200 }
)

mysql_users:
(
    { username = "${DB_USER:-gatuno_user}" , password = "${DB_PASS:-gatuno_pass}" , default_hostgroup = 1 , active = 1 }
)

mysql_query_rules:
(
    {
        rule_id=1
        active=1
        match_pattern="^SELECT .* FOR UPDATE$"
        destination_hostgroup=1
        apply=1
    },
    {
        rule_id=2
        active=1
        match_pattern="^/\* force_master \*/"
        destination_hostgroup=1
        apply=1
    },
    {
        rule_id=3
        active=1
        match_pattern="^SELECT"
        destination_hostgroup=2
        apply=1
    }
)
EOF

echo ">>> ProxySQL configuration generated dynamically."
exec proxysql -f -c /etc/proxysql.cnf
