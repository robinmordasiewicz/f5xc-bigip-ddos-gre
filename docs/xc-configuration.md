# F5 Distributed Cloud Configuration (Console)

This section summarizes the **F5 Distributed Cloud** side, based on
the [L3/L4 Routed DDoS Mitigation][xc-ddos-guide] guide.

## Enable the DDoS mitigation workspace

Before you can configure tunnels and BGP:

1. Contact the F5 Distributed Cloud team (via `sales@cloud.f5.com`
   or your F5 account team) to:
   - Enable **Routed DDoS Mitigation** workspace for your tenant.
   - Provide:
     - Your **public IP netblocks** (/24 or shorter for IPv4, /48 or
       shorter for IPv6) and proof of ownership (or LOA).
     - Your **ASN** (must be issued by ARIN or equivalent registry).
     - **IRR** registration (RIPE, ARIN, APNIC, etc.) and **ROA** in
       RPKI repository.
     - Desired **clean-traffic return method** (GRE tunnels, Layer 2,
       private peering via Equinix, etc.).
     - Data center locations and routers to protect.
     - **AS-Path prepends** required for route announcements.
     - Any **BGP communities**, route preferences, or **AS-SET**
       (optional).

1. F5 SOC will provision:
   - Tunnels
   - ASNs
   - Protected prefixes
   - Route advertisement options
   - Fast ACLs / firewall policies, as needed

## Configure tunnels in Console

1. Log in to the [F5 Distributed Cloud Console][xc-ddos-guide] and
   select **Routed DDoS** from the service selector.
1. Go to **Manage > Tunnels > Add Tunnel**.
1. Set:
   - **Location Name** and **Availability Zone** (Zone 1 by default).
   - **Bandwidth Max in MB**.
   - **Tunnel Type**:
     - **GRE Over IPv4** for IPv4 outer tunnel.
     - **GRE Over IPv6** for IPv6 outer tunnel.
     - **IP Over IP** for IPv4-in-IPv4 encapsulation.
     - **IPv6 Over IPv6** for IPv6-in-IPv6 encapsulation.
   - **Customer Endpoint IP**: BIG-IP's external address (outer self
     IP, must be publicly routable when tunnels traverse the public
     Internet).
   - Optional: IPv4/IPv6 interconnect, fragmentation, keepalive (all
     disabled by default).
1. Under **Tunnel BGP Information**:
   - Select an **ASN object** (your ASN).
   - Set **Customer Peer Secret Override**: Use Default Secret
     (default), BGP Password Override (blindfolded or clear text), or
     No Secret.
   - Set **Holddown Timer** value in seconds if different from
     default.

F5 SOC may pre-create these tunnel objects for you; you simply match
the **endpoint IPs** and BGP settings on BIG-IP.

## Configure ASNs, prefixes, and route advertisements

- **ASNs**:
  - **Manage > ASNs > Add ASN**.
  - Enter your ASN and ensure BGP is enabled.
- **Prefixes**:
  - **Manage > Prefixes > Add Prefix**.
  - Enter each IP prefix and associate it with your ASN.
- **Route Advertisements**:
  - **Manage > Route Advertisement > Add Route Advertisement**.
  - Enter prefix, choose **Active** or **Not Advertised**, and
    optional expiration.

These objects control which prefixes are announced via F5's global
network when the service is active.

## Optional: network firewall, deny lists, and Fast ACLs

**Firewall Rules**, **Deny List Rules**, and **Fast ACLs for Internet
VIPs** let you:

- Block or allow specific traffic.
- Rate-limit abusive sources.
- Apply additional DDoS protections beyond pure volumetric scrubbing.

[xc-ddos-guide]: https://docs.cloud.f5.com/docs-v2/ddos-and-transit-services/how-tos/network-firewall/l3l4-ddos-mitigation
[k000147949]: https://my.f5.com/manage/s/article/K000147949
[gre-devcentral]: https://community.f5.com/kb/technicalarticles/configuring-a-generic-routing-encapsulation-gre-tunnel-using-big-ip/289030
[imish-docs]: https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-0-0/11.html
[rfc5082]: https://datatracker.ietf.org/doc/html/rfc5082
[rfc6164]: https://datatracker.ietf.org/doc/html/rfc6164
