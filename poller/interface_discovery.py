from datetime import datetime, timezone

import httpx
from loguru import logger
from sqlalchemy.orm import Session

from .cisco_polling import fetch_cisco_data_async, parse_interfaces_catalog as parse_cisco_catalog
from .juniper_polling import (
    fetch_juniper_data_async,
    parse_interfaces_catalog as parse_juniper_catalog,
)
from .models import Device, Interface, InterfaceData


async def discover_device_interfaces_async(
    device: Device, client: httpx.AsyncClient
) -> list[InterfaceData]:
    """Fetch and parse the current interface inventory from a device."""

    protocol = "https" if device.https else "http"
    base_url = f"{protocol}://{device.ip}:{device.port}"
    vendor = device.vendor.lower()

    if vendor == "cisco":
        interface_url = f"{base_url}/restconf/data/ietf-interfaces:interfaces-state"
        raw_interfaces = await fetch_cisco_data_async(
            client, interface_url, device.username, device.password
        )
        return parse_cisco_catalog(raw_interfaces)

    if vendor == "juniper":
        interface_url = f"{base_url}/rpc/get-interface-information"
        raw_interfaces = await fetch_juniper_data_async(
            client, interface_url, device.username, device.password
        )
        return parse_juniper_catalog(raw_interfaces)

    raise ValueError(f"Unsupported vendor: {device.vendor}")


def sync_device_interfaces(
    db: Session, device_id: int, discovered: list[InterfaceData]
) -> list[Interface]:
    """Upsert discovered interfaces and remove entries no longer reported by the device."""

    now = datetime.now(timezone.utc)
    discovered_indices = {iface["if_index"] for iface in discovered}
    synced: list[Interface] = []

    for iface in discovered:
        speed = iface.get("speed", 0)
        existing = (
            db.query(Interface)
            .filter_by(device_id=device_id, if_index=iface["if_index"])
            .first()
        )

        if existing:
            existing.name = iface["name"]
            existing.mac = iface.get("mac")
            existing.speed_bps = speed
            existing.admin_status = iface.get("admin_status")
            existing.oper_status = iface.get("oper_status")
            synced.append(existing)
            continue

        new_interface = Interface(
            device_id=device_id,
            name=iface["name"],
            if_index=iface["if_index"],
            mac=iface.get("mac"),
            speed_bps=speed,
            admin_status=iface.get("admin_status"),
            oper_status=iface.get("oper_status"),
            discovered_at=now,
        )
        db.add(new_interface)
        synced.append(new_interface)

    stale_query = db.query(Interface).filter(Interface.device_id == device_id)
    if discovered_indices:
        stale_query = stale_query.filter(~Interface.if_index.in_(discovered_indices))
    removed_count = stale_query.count()
    stale_query.delete(synchronize_session=False)

    logger.info(
        f"Synced {len(synced)} interfaces for device_id={device_id} "
        f"(removed {removed_count} stale entries)"
    )

    return synced
