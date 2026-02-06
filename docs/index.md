# F5XC GRE/BGP BIG-IP

- Configure **GRE tunnels** and **BGP peering** from a BIG-IP HA pair
  (acting as customer premises equipment, CPE), with independent
  tunnels per unit.
- Connect to the **F5 Distributed Cloud DDoS Mitigation** scrubbing
  centers in **routed mode** (L3/L4).

```mermaid
flowchart LR
    INET["Internet<br/>Inbound Traffic"]

    subgraph XC["F5 Distributed Cloud<br/>Global Anycast"]
        SCRUB["DDoS Scrubbing<br/>L3/L4 Mitigation"]
        DROP["Attack Traffic<br/>Dropped"]
    end

    subgraph DC["xDC_NAMEx Data Center"]
        BIGIP["BIG-IP CPE<br/>(GRE endpoint)"]
        SERVERS["DDoS-Protected Servers<br/><i>Your public IP block</i>"]
    end

    INET -->|"all traffic to your<br/>public IPs"| SCRUB
    SCRUB -->|"clean traffic"| BIGIP
    SCRUB -.->|"malicious traffic"| DROP
    BIGIP --> SERVERS
    SERVERS --> BIGIP
    BIGIP -.->|"return traffic<br/>via ISP uplink<br/>(asymmetric path)"| INET

    style SERVERS fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

## Requirements

- F5 Distributed Cloud **L3/L4 Routed DDoS Mitigation** service
  (Always On or Always Available) enabled for your tenant.
- BIG-IP with:
  - LTM (or equivalent networking modules).
  - **Dynamic routing (BGP)** licensed and enabled.
- Routed mode: at least one **publicly advertised /24 (or shorter)**
  prefix for protection (IPv6 minimum is **/48**).
  - Protected prefixes **must be publicly routable** (non-RFC 1918).
    GRE outer endpoints must also be publicly routable when tunnels
    traverse the public Internet; deployments using private
    connectivity (L2, private peering) may use RFC 1918 endpoint
    addresses.
- Connectivity between your data center/router and the F5 Distributed
  Cloud scrubbing center(s).

---

## Protected prefix (public IP)

The **protected prefix** is your organization's public IP address block that
F5 Distributed Cloud defends against DDoS attacks.

| Requirement | IPv4 | IPv6 |
|-------------|------|------|
| **Minimum size** | /24 (256 IPs) | /48 |
| **Routability** | Publicly routable (non-RFC 1918) | Global unicast (non-ULA) |
| **Registration** | RIR-assigned (ARIN, RIPE, APNIC) | RIR-assigned |
| **Proof** | LOA or IRR/ROA registration | LOA or IRR/ROA registration |

**Traffic flow:**

1. F5 Distributed Cloud announces your prefix globally via BGP anycast
2. All Internet traffic destined for your IPs routes through F5 scrubbing centers
3. Attack traffic is dropped; clean traffic is delivered via GRE tunnels

!!! warning "Not your internal network"
    The protected prefix is your **public-facing IP space**, not internal
    RFC 1918 addresses. These are the IPs that external users connect to.

---

## Topology and addresses

Configuration for the **xDC_NAMEx** data center
connecting to F5 Distributed Cloud scrubbing centers.

!!! note
    **These are example values.** Replace with customer-specific and
    F5-provided values using the tables above.

    Protected prefixes **must be publicly routable** (non-RFC 1918).
    GRE outer endpoint IPs must also be publicly routable when tunnels
    traverse the public Internet; private connectivity (L2, private
    peering) may allow RFC 1918 endpoints. See
    [K000147949][k000147949] for examples using proper documentation
    addresses.

    For redundancy, create **2 tunnels per BIG-IP unit** to different
    geo-located F5 scrubbing centers (4 tunnels total for an HA pair).

```mermaid
flowchart LR
    INET["Internet<br/>Inbound Traffic"]

    subgraph XC["F5 Distributed Cloud"]
        C1["xCENTER_1x Scrubbing<br/>xXC_C1_OUTER_V4x"]
        C2["xCENTER_2x Scrubbing<br/>xXC_C2_OUTER_V4x"]
    end

    subgraph DC["xDC_NAMEx Data Center"]
        BIGIPA["BIG-IP-A<br/>xBIGIP_A_OUTER_V4x"]
        BIGIPB["BIG-IP-B<br/>xBIGIP_B_OUTER_V4x"]
        NET["DDoS-Protected Network<br/>xPROTECTED_PREFIX_V4x<br/>xPROTECTED_PREFIX_V6x<br/><i>Your public IP block</i>"]
    end

    INET --> C1
    INET --> C2
    C1 -- "GRE C1-T1" --> BIGIPA
    C2 -- "GRE C2-T1" --> BIGIPA
    C1 -- "GRE C1-T2" --> BIGIPB
    C2 -- "GRE C2-T2" --> BIGIPB
    BIGIPA --> NET
    BIGIPB --> NET

    style NET fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```
## Worksheets

Use the following XC and BIGIP-IP worksheets as reference when building the tunnel configuration.

### XC Worksheet

**Tunnel C1-T1 — Center 1 to BIG-IP-A:**

- GRE outer IPs (for tunnel endpoints):
  - IPv4 SRC: `xXC_C1_OUTER_V4x/24`
  - IPv4 DST: `xBIGIP_A_OUTER_V4x/24`
  - IPv6 SRC: `xXC_C1_OUTER_V6x/64`
  - IPv6 DST: `xBIGIP_A_OUTER_V6x/64`
- GRE inner IPs (for BGP session):
  - IPv4: `xXC_C1_T1_INNER_V4x/30`
  - IPv6: `xXC_C1_T1_INNER_V6x/64`

**Tunnel C1-T2 — Center 1 to BIG-IP-B:**

- GRE outer IPs (for tunnel endpoints):
  - IPv4 SRC: `xXC_C1_OUTER_V4x/24`
  - IPv4 DST: `xBIGIP_B_OUTER_V4x/24`
  - IPv6 SRC: `xXC_C1_OUTER_V6x/64`
  - IPv6 DST: `xBIGIP_B_OUTER_V6x/64`
- GRE inner IPs (for BGP session):
  - IPv4: `xXC_C1_T2_INNER_V4x/30`
  - IPv6: `xXC_C1_T2_INNER_V6x/64`

**Tunnel C2-T1 — Center 2 to BIG-IP-A:**

- GRE outer IPs (for tunnel endpoints):
  - IPv4 SRC: `xXC_C2_OUTER_V4x/24`
  - IPv4 DST: `xBIGIP_A_OUTER_V4x/24`
  - IPv6 SRC: `xXC_C2_OUTER_V6x/64`
  - IPv6 DST: `xBIGIP_A_OUTER_V6x/64`
- GRE inner IPs (for BGP session):
  - IPv4: `xXC_C2_T1_INNER_V4x/30`
  - IPv6: `xXC_C2_T1_INNER_V6x/64`

**Tunnel C2-T2 — Center 2 to BIG-IP-B:**

- GRE outer IPs (for tunnel endpoints):
  - IPv4 SRC: `xXC_C2_OUTER_V4x/24`
  - IPv4 DST: `xBIGIP_B_OUTER_V4x/24`
  - IPv6 SRC: `xXC_C2_OUTER_V6x/64`
  - IPv6 DST: `xBIGIP_B_OUTER_V6x/64`
- GRE inner IPs (for BGP session):
  - IPv4: `xXC_C2_T2_INNER_V4x/30`
  - IPv6: `xXC_C2_T2_INNER_V6x/64`

!!! info "Inner (transit) IPs"
    Inner IPs such as `10.10.10.0/30` use RFC 1918 addresses. This is
    correct because they are encapsulated inside the GRE tunnel and never
    appear on the public Internet. Protected prefixes must always be
    publicly routable; outer endpoint IPs must be publicly routable when
    tunnels traverse the public Internet.

!!! info "IPv6 inner links"
    IPv6 inner links use /64 prefixes here to match common F5 Distributed
    Cloud defaults. For point-to-point links, /127 is preferred per
    [RFC 6164][rfc6164] to avoid neighbor-discovery exhaustion. Use /127
    if your F5 SOC tunnel assignment supports it.

### BIG-IP Worksheet

**BIG-IP-A** (outer IP `xBIGIP_A_OUTER_V4x` / `xBIGIP_A_OUTER_V6x`):

- GRE outer IPs:
  - IPv4 SRC: `xBIGIP_A_OUTER_V4x/24`
  - IPv4 DST (Center 1): `xXC_C1_OUTER_V4x/24`
  - IPv4 DST (Center 2): `xXC_C2_OUTER_V4x/24`
  - IPv6 SRC: `xBIGIP_A_OUTER_V6x/64`
  - IPv6 DST (Center 1): `xXC_C1_OUTER_V6x/64`
  - IPv6 DST (Center 2): `xXC_C2_OUTER_V6x/64`
- GRE inner IPs — Tunnel C1-T1:
  - IPv4: `xBIGIP_C1_T1_INNER_V4x/30`
  - IPv6: `xBIGIP_C1_T1_INNER_V6x/64`
- GRE inner IPs — Tunnel C2-T1:
  - IPv4: `xBIGIP_C2_T1_INNER_V4x/30`
  - IPv6: `xBIGIP_C2_T1_INNER_V6x/64`

**BIG-IP-B** (outer IP `xBIGIP_B_OUTER_V4x` / `xBIGIP_B_OUTER_V6x`):

- GRE outer IPs:
  - IPv4 SRC: `xBIGIP_B_OUTER_V4x/24`
  - IPv4 DST (Center 1): `xXC_C1_OUTER_V4x/24`
  - IPv4 DST (Center 2): `xXC_C2_OUTER_V4x/24`
  - IPv6 SRC: `xBIGIP_B_OUTER_V6x/64`
  - IPv6 DST (Center 1): `xXC_C1_OUTER_V6x/64`
  - IPv6 DST (Center 2): `xXC_C2_OUTER_V6x/64`
- GRE inner IPs — Tunnel C1-T2:
  - IPv4: `xBIGIP_C1_T2_INNER_V4x/30`
  - IPv6: `xBIGIP_C1_T2_INNER_V6x/64`
- GRE inner IPs — Tunnel C2-T2:
  - IPv4: `xBIGIP_C2_T2_INNER_V4x/30`
  - IPv6: `xBIGIP_C2_T2_INNER_V6x/64`

- Protected prefixes (advertised to F5 Distributed Cloud):
  - IPv4: `xPROTECTED_NET_V4xxPROTECTED_CIDR_V4x`
  - IPv6: `xPROTECTED_PREFIX_V6x`

```mermaid
flowchart LR
    subgraph XC["F5 Distributed Cloud"]
        C1["xCENTER_1x<br/>xXC_C1_OUTER_V4x<br/>xXC_C1_OUTER_V6x"]
        C2["xCENTER_2x<br/>xXC_C2_OUTER_V4x<br/>xXC_C2_OUTER_V6x"]
    end

    subgraph DC["xDC_NAMEx Data Center"]
        subgraph BIGIPA["BIG-IP-A<br/>xBIGIP_A_OUTER_V4x<br/>xBIGIP_A_OUTER_V6x"]
            T1_INNER["C1-T1 Inner<br/>xBIGIP_C1_T1_INNER_V4x<br/>xBIGIP_C1_T1_INNER_V6x"]
            T2_INNER["C2-T1 Inner<br/>xBIGIP_C2_T1_INNER_V4x<br/>xBIGIP_C2_T1_INNER_V6x"]
        end

        subgraph BIGIPB["BIG-IP-B<br/>xBIGIP_B_OUTER_V4x<br/>xBIGIP_B_OUTER_V6x"]
            T3_INNER["C1-T2 Inner<br/>xBIGIP_C1_T2_INNER_V4x<br/>xBIGIP_C1_T2_INNER_V6x"]
            T4_INNER["C2-T2 Inner<br/>xBIGIP_C2_T2_INNER_V4x<br/>xBIGIP_C2_T2_INNER_V6x"]
        end
    end

    C1 == "GRE C1-T1" ==> T1_INNER
    C2 == "GRE C2-T1" ==> T2_INNER
    C1 == "GRE C1-T2" ==> T3_INNER
    C2 == "GRE C2-T2" ==> T4_INNER

    C1 -. "BGP tcp/179<br/>xXC_C1_T1_INNER_V4x &#8594; xBIGIP_C1_T1_INNER_V4x" .-> T1_INNER
    C2 -. "BGP tcp/179<br/>xXC_C2_T1_INNER_V4x &#8594; xBIGIP_C2_T1_INNER_V4x" .-> T2_INNER
    C1 -. "BGP tcp/179<br/>xXC_C1_T2_INNER_V4x &#8594; xBIGIP_C1_T2_INNER_V4x" .-> T3_INNER
    C2 -. "BGP tcp/179<br/>xXC_C2_T2_INNER_V4x &#8594; xBIGIP_C2_T2_INNER_V4x" .-> T4_INNER
```

---
## Configs

### XC (UI)

Use the web interface to configure the **F5 Distributed Cloud** side, based on
the [L3/L4 Routed DDoS Mitigation][xc-ddos-guide] guide.

#### Enable DDoS workspace

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

#### Tunnels

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

#### ASNs and Routes

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

####  Network Restriction

**Firewall Rules**, **Deny List Rules**, and **Fast ACLs for Internet
VIPs** let you:

- Block or allow specific traffic.
- Rate-limit abusive sources.
- Apply additional DDoS protections beyond pure volumetric scrubbing.

---

### BIG-IP

- (Route Domain 0 example)

All commands below are run in **tmsh** on BIG-IP. Adjust object names
and IPs as needed.

For general GRE tunnel configuration on BIG-IP, see
[Configuring a GRE Tunnel Using BIG-IP][gre-devcentral]. For initial
routed configuration setup with F5 XC, see [K000147949][k000147949].

#### tmsh

```bash
[root@bigip:Active]# tmsh
root@(bigip)(cfg-sync Standalone)(Active)(/Common)(tmos)#
```

#### Outer Self IPs

GRE endpoints

These are the IPs on each BIG-IP unit used as **GRE tunnel
endpoints**, typically on the external VLAN. Each unit has its own
non-floating outer self IP (`traffic-group-local-only`):

**BIG-IP-A:**

```shell
create net self xc-ddos-v4-self-a \
  vlan external \
  traffic-group traffic-group-local-only \
  allow-service add { icmp:any gre:any } \
  address xBIGIP_A_OUTER_V4x/24

create net self xc-ddos-v6-self-a \
  vlan external \
  traffic-group traffic-group-local-only \
  allow-service add { icmp:any gre:any } \
  address xBIGIP_A_OUTER_V6x/64
```

**BIG-IP-B:**

```shell
create net self xc-ddos-v4-self-b \
  vlan external \
  traffic-group traffic-group-local-only \
  allow-service add { icmp:any gre:any } \
  address xBIGIP_B_OUTER_V4x/24

create net self xc-ddos-v6-self-b \
  vlan external \
  traffic-group traffic-group-local-only \
  allow-service add { icmp:any gre:any } \
  address xBIGIP_B_OUTER_V6x/64
```

#### GRE tunnels

Each tunnel points from a BIG-IP unit to an F5 Distributed Cloud
scrubbing center endpoint. Create **two tunnels per unit** (one to
each geo-located scrubbing center) for a total of **four logical
tunnels** across the HA pair:

**Tunnel C1-T1 — BIG-IP-A to xCENTER_1x:**

```shell
create net tunnels tunnel xc-ddos-c1t1-v4 \
  local-address xBIGIP_A_OUTER_V4x \
  profile gre \
  remote-address xXC_C1_OUTER_V4x

create net tunnels tunnel xc-ddos-c1t1-v6 \
  local-address xBIGIP_A_OUTER_V6x \
  profile gre \
  remote-address xXC_C1_OUTER_V6x
```

**Tunnel C2-T1 — BIG-IP-A to xCENTER_2x:**

```shell
create net tunnels tunnel xc-ddos-c2t1-v4 \
  local-address xBIGIP_A_OUTER_V4x \
  profile gre \
  remote-address xXC_C2_OUTER_V4x

create net tunnels tunnel xc-ddos-c2t1-v6 \
  local-address xBIGIP_A_OUTER_V6x \
  profile gre \
  remote-address xXC_C2_OUTER_V6x
```

**Tunnel C1-T2 — BIG-IP-B to xCENTER_1x:**

```shell
create net tunnels tunnel xc-ddos-c1t2-v4 \
  local-address xBIGIP_B_OUTER_V4x \
  profile gre \
  remote-address xXC_C1_OUTER_V4x

create net tunnels tunnel xc-ddos-c1t2-v6 \
  local-address xBIGIP_B_OUTER_V6x \
  profile gre \
  remote-address xXC_C1_OUTER_V6x
```

**Tunnel C2-T2 — BIG-IP-B to xCENTER_2x:**

```shell
create net tunnels tunnel xc-ddos-c2t2-v4 \
  local-address xBIGIP_B_OUTER_V4x \
  profile gre \
  remote-address xXC_C2_OUTER_V4x

create net tunnels tunnel xc-ddos-c2t2-v6 \
  local-address xBIGIP_B_OUTER_V6x \
  profile gre \
  remote-address xXC_C2_OUTER_V6x
```

Tunnel names (`xc-ddos-c1t1-v4`, etc.) are arbitrary; use your own
naming convention.

#### Set tunnel MTU

GRE encapsulation adds overhead (24 bytes for IPv4 outer, 44 bytes
for IPv6 outer). Without an explicit MTU, packets near 1500 bytes
will fragment or be dropped. Set the tunnel MTU to account for
encapsulation overhead:

```shell
modify net tunnels tunnel xc-ddos-c1t1-v4 mtu 1476
modify net tunnels tunnel xc-ddos-c1t1-v6 mtu 1456
modify net tunnels tunnel xc-ddos-c1t2-v4 mtu 1476
modify net tunnels tunnel xc-ddos-c1t2-v6 mtu 1456
modify net tunnels tunnel xc-ddos-c2t1-v4 mtu 1476
modify net tunnels tunnel xc-ddos-c2t1-v6 mtu 1456
modify net tunnels tunnel xc-ddos-c2t2-v4 mtu 1476
modify net tunnels tunnel xc-ddos-c2t2-v6 mtu 1456
```

!!! warning "Path MTU"
    The values above assume a 1500-byte path MTU on the outer network.
    Adjust if your upstream path MTU is smaller. Ensure ICMP
    "destination unreachable / fragmentation needed" (type 3, code 4)
    is **not** blocked on any intermediate device so that Path MTU
    Discovery (PMTUD) functions correctly.

#### GRE anti-spoofing

- (upstream ACLs)

GRE (IP protocol 47) does not provide authentication. Anyone who
knows the outer IP pair can inject traffic into the tunnel. Apply
ACLs on the upstream router or firewall to restrict inbound GRE to
only the expected F5 scrubbing-center source IPs:

```shell
! Example upstream router ACL (Cisco IOS style)
ip access-list extended ALLOW-XC-GRE
  permit gre host xXC_C1_OUTER_V4x host xBIGIP_A_OUTER_V4x
  permit gre host xXC_C2_OUTER_V4x host xBIGIP_A_OUTER_V4x
  permit gre host xXC_C1_OUTER_V4x host xBIGIP_B_OUTER_V4x
  permit gre host xXC_C2_OUTER_V4x host xBIGIP_B_OUTER_V4x
  deny   gre any host xBIGIP_A_OUTER_V4x log
  deny   gre any host xBIGIP_B_OUTER_V4x log
```

!!! note
    Adapt the syntax for your router platform. The same principle
    applies to IPv6 ACLs for the IPv6 GRE tunnels. Both BIG-IP-A
    (`xBIGIP_A_OUTER_V4x`) and BIG-IP-B (`xBIGIP_B_OUTER_V4x`)
    outer IPs must be permitted as GRE destinations.

#### Inner Self-IPs

(BGP peering)

Assign inner IP addresses (inside the GRE tunnel) that will form the
**BGP session** with F5 Distributed Cloud. The `allow-service` must
include `tcp:179` (BGP) for the peering session to establish. Adding
`icmp:any` on the inner self IPs enables PMTUD and reachability
testing through the tunnel:

**Tunnel C1-T1 — BIG-IP-A to xCENTER_1x:**

```shell
create net self xc-ddos-c1t1-inner-v4 \
  vlan xc-ddos-c1t1-v4 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C1_T1_INNER_V4x/30

create net self xc-ddos-c1t1-inner-v6 \
  vlan xc-ddos-c1t1-v6 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C1_T1_INNER_V6x/64
```

**Tunnel C2-T1 — BIG-IP-A to xCENTER_2x:**

```shell
create net self xc-ddos-c2t1-inner-v4 \
  vlan xc-ddos-c2t1-v4 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C2_T1_INNER_V4x/30

create net self xc-ddos-c2t1-inner-v6 \
  vlan xc-ddos-c2t1-v6 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C2_T1_INNER_V6x/64
```

**Tunnel C1-T2 — BIG-IP-B to xCENTER_1x:**

```shell
create net self xc-ddos-c1t2-inner-v4 \
  vlan xc-ddos-c1t2-v4 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C1_T2_INNER_V4x/30

create net self xc-ddos-c1t2-inner-v6 \
  vlan xc-ddos-c1t2-v6 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C1_T2_INNER_V6x/64
```

**Tunnel C2-T2 — BIG-IP-B to xCENTER_2x:**

```shell
create net self xc-ddos-c2t2-inner-v4 \
  vlan xc-ddos-c2t2-v4 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C2_T2_INNER_V4x/30

create net self xc-ddos-c2t2-inner-v6 \
  vlan xc-ddos-c2t2-v6 \
  traffic-group traffic-group-local-only \
  allow-service add { tcp:179 icmp:any } \
  address xBIGIP_C2_T2_INNER_V6x/64
```

#### BGP

Use [imish][imish-docs] to configure BGP for Route Domain 0.

!!! note "Per-unit configuration"
    The `imish` BGP configuration is local to each BIG-IP unit. Each
    unit only configures neighbors for its own tunnels:

    - **BIG-IP-A** configures C1-T1 and C2-T1 neighbors.
    - **BIG-IP-B** configures C1-T2 and C2-T2 neighbors.

    The `router-id` must be unique per unit (use each unit's own outer
    self IP).

1. Enter imish for RD 0:

   ```bash
   tmsh run /util imish -r 0
   ```

1. Enter privileged and config mode:

   ```shell
   localhost.localdomain[0]> enable
   localhost.localdomain[0]# configure terminal
   ```

1. Example BGP configuration:

!!! warning "Replace placeholder values"
    - `xCUSTOMER_ASNx` — your public ASN registered with ARIN (or
      equivalent RIR). A **public ASN is required** for routed DDoS
      because F5 Distributed Cloud will announce your prefixes globally.
      A private ASN (64512-65534 / 4200000000-4294967294) is only
      acceptable if F5 SOC explicitly supports private-ASN peering for
      your deployment.
    - `xF5_XC_ASNx` — F5's ASN (provided by the SOC).
    - `xBGP_PASSWORDx` — the agreed BGP MD5 password (or match Console
      "default secret"). Never reuse this password for other services.

**BIG-IP-A** (router-id `xBIGIP_A_OUTER_V4x`, neighbors C1-T1 + C2-T1):

```shell
router bgp xCUSTOMER_ASNx
  no synchronization
  bgp log-neighbor-changes
  no auto-summary
  bgp router-id xBIGIP_A_OUTER_V4x
  bgp graceful-restart restart-time 120
  redistribute kernel route-map route-to-f5-ipv4

  neighbor f5xc peer-group
  neighbor f5xc remote-as xF5_XC_ASNx
  neighbor f5xc description f5xc-peer-group
  neighbor f5xc password xBGP_PASSWORDx
  neighbor f5xc timers 10 30
  neighbor f5xc soft-reconfiguration inbound
  neighbor f5xc version 4
  neighbor f5xc capability graceful-restart
  neighbor f5xc send-community
  neighbor f5xc ttl-security hops 1
  neighbor f5xc maximum-prefix 10 warning-only
  neighbor f5xc prefix-list deny-all in
  neighbor f5xc prefix-list route-to-f5-ipv4 out

  neighbor xXC_C1_T1_INNER_V4x peer-group f5xc
  neighbor xXC_C1_T1_INNER_V4x description f5xc-c1-t1-v4

  neighbor xXC_C2_T1_INNER_V4x peer-group f5xc
  neighbor xXC_C2_T1_INNER_V4x description f5xc-c2-t1-v4

  address-family ipv6
    redistribute kernel route-map route-to-f5-ipv6
    neighbor f5xc activate
    neighbor f5xc soft-reconfiguration inbound
    neighbor f5xc capability graceful-restart
    neighbor f5xc prefix-list deny-all6 in
    neighbor f5xc prefix-list route-to-f5-ipv6 out
    neighbor xXC_C1_T1_INNER_V6x peer-group f5xc
    neighbor xXC_C1_T1_INNER_V6x description f5xc-c1-t1-v6
    neighbor xXC_C2_T1_INNER_V6x peer-group f5xc
    neighbor xXC_C2_T1_INNER_V6x description f5xc-c2-t1-v6
  exit-address-family

ip prefix-list deny-all deny 0.0.0.0/0 le 32
ip prefix-list route-to-f5-ipv4 permit xPROTECTED_PREFIX_V4x

ipv6 prefix-list deny-all6 deny ::/0 le 128
ipv6 prefix-list route-to-f5-ipv6 permit xPROTECTED_PREFIX_V6x

ip route xPROTECTED_NET_V4x xPROTECTED_MASK_V4x null0 201
ipv6 route xPROTECTED_PREFIX_V6x null0 201

route-map route-to-f5-ipv4 permit 10
  match ip address prefix-list route-to-f5-ipv4
  set origin igp

route-map route-to-f5-ipv6 permit 10
  match ipv6 address prefix-list route-to-f5-ipv6
  set origin igp
```

**BIG-IP-B** (router-id `xBIGIP_B_OUTER_V4x`, neighbors C1-T2 + C2-T2):

```shell
router bgp xCUSTOMER_ASNx
  no synchronization
  bgp log-neighbor-changes
  no auto-summary
  bgp router-id xBIGIP_B_OUTER_V4x
  bgp graceful-restart restart-time 120
  redistribute kernel route-map route-to-f5-ipv4

  neighbor f5xc peer-group
  neighbor f5xc remote-as xF5_XC_ASNx
  neighbor f5xc description f5xc-peer-group
  neighbor f5xc password xBGP_PASSWORDx
  neighbor f5xc timers 10 30
  neighbor f5xc soft-reconfiguration inbound
  neighbor f5xc version 4
  neighbor f5xc capability graceful-restart
  neighbor f5xc send-community
  neighbor f5xc ttl-security hops 1
  neighbor f5xc maximum-prefix 10 warning-only
  neighbor f5xc prefix-list deny-all in
  neighbor f5xc prefix-list route-to-f5-ipv4 out

  neighbor xXC_C1_T2_INNER_V4x peer-group f5xc
  neighbor xXC_C1_T2_INNER_V4x description f5xc-c1-t2-v4

  neighbor xXC_C2_T2_INNER_V4x peer-group f5xc
  neighbor xXC_C2_T2_INNER_V4x description f5xc-c2-t2-v4

  address-family ipv6
    redistribute kernel route-map route-to-f5-ipv6
    neighbor f5xc activate
    neighbor f5xc soft-reconfiguration inbound
    neighbor f5xc capability graceful-restart
    neighbor f5xc prefix-list deny-all6 in
    neighbor f5xc prefix-list route-to-f5-ipv6 out
    neighbor xXC_C1_T2_INNER_V6x peer-group f5xc
    neighbor xXC_C1_T2_INNER_V6x description f5xc-c1-t2-v6
    neighbor xXC_C2_T2_INNER_V6x peer-group f5xc
    neighbor xXC_C2_T2_INNER_V6x description f5xc-c2-t2-v6
  exit-address-family

ip prefix-list deny-all deny 0.0.0.0/0 le 32
ip prefix-list route-to-f5-ipv4 permit xPROTECTED_PREFIX_V4x

ipv6 prefix-list deny-all6 deny ::/0 le 128
ipv6 prefix-list route-to-f5-ipv6 permit xPROTECTED_PREFIX_V6x

ip route xPROTECTED_NET_V4x xPROTECTED_MASK_V4x null0 201
ipv6 route xPROTECTED_PREFIX_V6x null0 201

route-map route-to-f5-ipv4 permit 10
  match ip address prefix-list route-to-f5-ipv4
  set origin igp

route-map route-to-f5-ipv6 permit 10
  match ipv6 address prefix-list route-to-f5-ipv6
  set origin igp
```

**Key BGP settings explained:**

- **`timers 10 30`** — Keepalive every 10 s, hold time 30 s. The
  default (60 / 180) is too slow for DDoS mitigation failover.
  Coordinate timer values with F5 SOC to match both sides.
- **`ttl-security hops 1`** — Enables GTSM
  ([RFC 5082][rfc5082]). Because the BGP sessions are single-hop
  over the GRE tunnel, this prevents remote BGP spoofing by
  requiring TTL = 255 on incoming BGP packets.
- **`maximum-prefix 10 warning-only`** — Defence-in-depth safeguard.
  Even though the inbound prefix-list denies all routes, this
  generates a warning if the peer unexpectedly sends prefixes.
- **`redistribute kernel`** — Injects the `null0` static routes into
  BGP via the route-map. An alternative is to use explicit `network`
  statements (e.g. `network xPROTECTED_PREFIX_V4x`), which are more precise
  because only the exact prefix is advertised regardless of other
  kernel routes. Either approach works; `redistribute kernel` with a
  strict route-map is shown here for flexibility.

!!! tip "BFD (Bidirectional Forwarding Detection)"
    If your BIG-IP version supports BFD over GRE tunnels, enable it
    for sub-second failure detection:

    ```shell
    neighbor f5xc fall-over bfd
    ```

    BFD provides faster convergence than BGP keepalive timers alone.
    Confirm BFD support with your BIG-IP version and F5 SOC before
    enabling.

The `null0` static routes with higher administrative distance (201)
ensure the prefixes exist in the **kernel routing table**, so they can
be redistributed to F5 Distributed Cloud via BGP without affecting
normal routing under non-attack conditions. If the protected prefix
already exists in the routing table from another source with a lower
administrative distance, the `null0` route will not be active and
redistribution may fail — verify with `show ip route` after
configuration.

---

## Verification

### BIG-IP

#### Verify tunnels

Run on each unit for its own tunnels:

```shell
show net tunnels tunnel xc-ddos-c1t1-v4
show net tunnels tunnel xc-ddos-c1t1-v6
show net tunnels tunnel xc-ddos-c1t2-v4
show net tunnels tunnel xc-ddos-c1t2-v6
show net tunnels tunnel xc-ddos-c2t1-v4
show net tunnels tunnel xc-ddos-c2t1-v6
show net tunnels tunnel xc-ddos-c2t2-v4
show net tunnels tunnel xc-ddos-c2t2-v6
list net tunnels tunnel xc-ddos-c1t1-v4 all-properties
```

#### Verify

```shell
list net self xc-ddos-*
```

#### Path Check

From each unit:

```shell
# BIG-IP-A tunnels
ping xXC_C1_T1_INNER_V4x source xBIGIP_C1_T1_INNER_V4x
ping xXC_C2_T1_INNER_V4x source xBIGIP_C2_T1_INNER_V4x

# BIG-IP-B tunnels
ping xXC_C1_T2_INNER_V4x source xBIGIP_C1_T2_INNER_V4x
ping xXC_C2_T2_INNER_V4x source xBIGIP_C2_T2_INNER_V4x
```

#### BGP

In imish on each unit:

```shell
show ip bgp summary
show ipv6 bgp summary
show ip bgp
show ipv6 bgp

# BIG-IP-A neighbors
show ip bgp neighbors xXC_C1_T1_INNER_V4x
show ip bgp neighbors xXC_C2_T1_INNER_V4x
show ip bgp neighbors xXC_C1_T1_INNER_V4x advertised-routes
show ip bgp neighbors xXC_C1_T1_INNER_V4x received-routes

# BIG-IP-B neighbors
show ip bgp neighbors xXC_C1_T2_INNER_V4x
show ip bgp neighbors xXC_C2_T2_INNER_V4x
show ip bgp neighbors xXC_C1_T2_INNER_V4x advertised-routes
show ip bgp neighbors xXC_C1_T2_INNER_V4x received-routes

show ip route
show ipv6 route
```

!!! warning "Troubleshooting checklist"
    If BGP does not establish:

    1. Verify the GRE tunnel is up: `show net tunnels tunnel` should
       show state `up`.
    2. Confirm `allow-service` includes `tcp:179` on the inner self IP.
    3. Ping the remote inner IP through the tunnel.
    4. Check BGP password matches on both sides (common cause of
       `NOTIFICATION` errors).
    5. Verify prefix-lists and route-maps are applied correctly.
    6. Check `show ip bgp neighbors <IP>` for the last error/reset
       reason.
    7. On each HA unit, verify the unit's own tunnels are up and its
       own BGP neighbors are configured (not the other unit's).

### XC Console

Go to **DDoS and Transit Services >
[DDoS Protection > Visibility][xc-ddos-guide]** to see:

- Traffic by network, zone, application.
- Blocked vs. allowed traffic.
- Attack details and scrubbing actions.

---

## BIG-IP HA pair

If BIG-IP is deployed as an **active/standby HA pair**, each unit
gets its own independent GRE tunnels and BGP sessions to every
scrubbing center:

```mermaid
flowchart LR
    subgraph F5XC["F5 Distributed Cloud"]
        C1["xCENTER_1x scrubbing center"]
        C2["xCENTER_2x scrubbing center"]
    end

    subgraph DC["xDC_NAMEx Data Center"]
        direction TB
        subgraph UNITA["BIG-IP-A (Active)"]
            A_C1["C1-T1 tunnel<br/>BGP Established"]
            A_C2["C2-T1 tunnel<br/>BGP Established"]
        end
        subgraph UNITB["BIG-IP-B (Standby)"]
            B_C1["C1-T2 tunnel<br/>Graceful-Restart Ready"]
            B_C2["C2-T2 tunnel<br/>Graceful-Restart Ready"]
        end
        SERVERS["DDoS-Protected Servers<br/>xPROTECTED_PREFIX_V4x<br/><i>Your public IP block</i>"]
    end

    C1 -- "GRE C1-T1" --> A_C1
    C2 -- "GRE C2-T1" --> A_C2
    C1 -- "GRE C1-T2" --> B_C1
    C2 -- "GRE C2-T2" --> B_C2
    UNITA --> SERVERS
    UNITB --> SERVERS

    style SERVERS fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

- **Independent tunnel endpoints**: Each BIG-IP unit has its own
  non-floating outer self IP (`traffic-group-local-only`) and its
  own set of GRE tunnels. BIG-IP-A uses `xBIGIP_A_OUTER_V4x` and
  BIG-IP-B uses `xBIGIP_B_OUTER_V4x` as tunnel endpoints. This avoids
  dependence on a floating IP for tunnel sourcing.
- **Independent BGP sessions**: Each unit runs its own BGP sessions
  over its own tunnels. BIG-IP-A peers with C1-T1 and C2-T1;
  BIG-IP-B peers with C1-T2 and C2-T2. On failover the standby
  unit's BGP sessions are already established, so F5 Distributed
  Cloud can shift traffic immediately.
- **Config sync**: Tunnel, self IP, and routing configurations are
  synced between units via **config-sync**. Because the `imish`
  BGP configuration is per-unit, each unit maintains its own
  neighbor statements. Verify sync includes all tmsh objects.
- **Active/standby BGP behavior**: The active unit advertises
  protected prefixes with normal BGP attributes. The standby unit
  can either advertise the same prefixes with a longer AS-path
  prepend (making it less preferred) or suppress advertisements
  until failover. Coordinate the approach with F5 SOC.
- **Failover convergence**: With `graceful-restart` enabled and
  independent tunnels, the new active unit already has established
  BGP sessions. Convergence depends on BGP best-path selection
  shifting to the newly active unit's advertisements. Test with
  `run sys failover standby`.

!!! note
    The independent-tunnel HA model above is the recommended approach
    for customer-side device redundancy. Validate your specific
    failover design with your F5 account team before going to
    production, particularly around AS-path prepend strategy and BGP
    reconvergence timing.

[xc-ddos-guide]: https://docs.cloud.f5.com/docs-v2/ddos-and-transit-services/how-tos/network-firewall/l3l4-ddos-mitigation
[k000147949]: https://my.f5.com/manage/s/article/K000147949
[gre-devcentral]: https://community.f5.com/kb/technicalarticles/configuring-a-generic-routing-encapsulation-gre-tunnel-using-big-ip/289030
[imish-docs]: https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-0-0/11.html
[rfc5082]: https://datatracker.ietf.org/doc/html/rfc5082
[rfc6164]: https://datatracker.ietf.org/doc/html/rfc6164
