from datetime import datetime, timezone
from unittest.mock import MagicMock

from poller import interface_discovery
from poller.models import Interface


def test_sync_device_interfaces_creates_and_updates():
    db = MagicMock()
    existing = Interface(
        id=1,
        device_id=10,
        name="Gi0/0",
        if_index=1,
        mac="aa:bb:cc:dd:ee:ff",
        speed_bps=1_000_000_000,
        admin_status="up",
        oper_status="up",
        discovered_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    def query_side_effect(model):
        query = MagicMock()
        if model is Interface:
            query.filter_by.return_value.first.return_value = existing
            filtered = MagicMock()
            filtered.count.return_value = 0
            filtered.delete.return_value = 0
            query.filter.return_value = filtered
        return query

    db.query.side_effect = query_side_effect

    discovered = [
        {
            "name": "Gi0/0-renamed",
            "if_index": 1,
            "in_octets": 0,
            "out_octets": 0,
            "speed": 1_000_000_000,
            "admin_status": "up",
            "oper_status": "down",
            "mac": "aa:bb:cc:dd:ee:ff",
        },
        {
            "name": "Gi0/1",
            "if_index": 2,
            "in_octets": 0,
            "out_octets": 0,
            "speed": 0,
            "admin_status": "down",
            "oper_status": "down",
            "mac": "unknown",
        },
    ]

    synced = interface_discovery.sync_device_interfaces(db, 10, discovered)

    assert len(synced) == 2
    assert existing.name == "Gi0/0-renamed"
    assert existing.oper_status == "down"
    db.add.assert_called_once()


def test_parse_cisco_interfaces_catalog_includes_admin_down():
    from poller.cisco_polling import parse_interfaces_catalog

    sample_response = {
        "ietf-interfaces:interfaces-state": {
            "interface": [
                {
                    "name": "GigabitEthernet1",
                    "admin-status": "up",
                    "oper-status": "up",
                    "if-index": "101",
                    "speed": "1000000000",
                    "phys-address": "00:11:22:33:44:55",
                    "statistics": {"in-octets": "100", "out-octets": "200"},
                },
                {
                    "name": "GigabitEthernet2",
                    "admin-status": "down",
                    "oper-status": "down",
                    "if-index": "102",
                    "speed": "1000000000",
                    "statistics": {},
                },
            ]
        }
    }

    parsed = parse_interfaces_catalog(sample_response)

    assert len(parsed) == 2
    assert parsed[1]["name"] == "GigabitEthernet2"
    assert parsed[1]["admin_status"] == "down"
