# Key Concepts

## Route domains

A **route domain** is a logical routing table on BIG-IP that:

- Isolates network traffic for a particular application/tenant.
- Allows re-use of overlapping IP addresses in different route
  domains.
- Is identified by a numeric Route Domain ID (for example, 0, 1) and
  referenced as `IP%ID`.

This guide assumes **Route Domain 0** (the default).

## VLANs and tunnels

- You can assign one or more **VLANs** or **tunnels** to a route
  domain.
- Each VLAN/tunnel can belong to **only one** route domain.
- GRE tunnels used for F5 Distributed Cloud are treated like VLAN
  objects on BIG-IP.

## Dynamic routing (BGP)

- For each route domain, you can enable dynamic routing protocols
  such as **BGP**.
- BGP in this design:
  - Establishes a peering session between BIG-IP and F5 Distributed
    Cloud.
  - Advertises customer prefixes that should be protected.
  - Receives routes for return (clean) traffic.

[xc-ddos-guide]: https://docs.cloud.f5.com/docs-v2/ddos-and-transit-services/how-tos/network-firewall/l3l4-ddos-mitigation
[k000147949]: https://my.f5.com/manage/s/article/K000147949
[gre-devcentral]: https://community.f5.com/kb/technicalarticles/configuring-a-generic-routing-encapsulation-gre-tunnel-using-big-ip/289030
[imish-docs]: https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-0-0/11.html
[rfc5082]: https://datatracker.ietf.org/doc/html/rfc5082
[rfc6164]: https://datatracker.ietf.org/doc/html/rfc6164
