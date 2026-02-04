# Validation and Troubleshooting

## On BIG-IP

### Verify tunnels and MTU

Run on each unit for its own tunnels:

```shell
show net tunnels tunnel xc-ddos-sjc1-v4
show net tunnels tunnel xc-ddos-sjc1-v6
show net tunnels tunnel xc-ddos-sjc2-v4
show net tunnels tunnel xc-ddos-sjc2-v6
show net tunnels tunnel xc-ddos-iad1-v4
show net tunnels tunnel xc-ddos-iad1-v6
show net tunnels tunnel xc-ddos-iad2-v4
show net tunnels tunnel xc-ddos-iad2-v6
list net tunnels tunnel xc-ddos-sjc1-v4 all-properties
```

### Verify self IPs

```shell
list net self xc-ddos-*
```

### Test reachability through the tunnel

From each unit:

```shell
# BIG-IP-A tunnels
ping xXC_SJC1_INNER_V4x source xBIGIP_SJC1_INNER_V4x
ping xXC_IAD1_INNER_V4x source xBIGIP_IAD1_INNER_V4x

# BIG-IP-B tunnels
ping xXC_SJC2_INNER_V4x source xBIGIP_SJC2_INNER_V4x
ping xXC_IAD2_INNER_V4x source xBIGIP_IAD2_INNER_V4x
```

### Verify BGP

In imish on each unit:

```text
show ip bgp summary
show ipv6 bgp summary
show ip bgp
show ipv6 bgp

# BIG-IP-A neighbors
show ip bgp neighbors xXC_SJC1_INNER_V4x
show ip bgp neighbors xXC_IAD1_INNER_V4x
show ip bgp neighbors xXC_SJC1_INNER_V4x advertised-routes
show ip bgp neighbors xXC_SJC1_INNER_V4x received-routes

# BIG-IP-B neighbors
show ip bgp neighbors xXC_SJC2_INNER_V4x
show ip bgp neighbors xXC_IAD2_INNER_V4x
show ip bgp neighbors xXC_SJC2_INNER_V4x advertised-routes
show ip bgp neighbors xXC_SJC2_INNER_V4x received-routes

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

## On F5 Distributed Cloud Console

Go to **DDoS and Transit Services >
[DDoS Protection > Visibility][xc-ddos-guide]** to see:

- Traffic by network, zone, application.
- Blocked vs. allowed traffic.
- Attack details and scrubbing actions.

[xc-ddos-guide]: https://docs.cloud.f5.com/docs-v2/ddos-and-transit-services/how-tos/network-firewall/l3l4-ddos-mitigation
[k000147949]: https://my.f5.com/manage/s/article/K000147949
[gre-devcentral]: https://community.f5.com/kb/technicalarticles/configuring-a-generic-routing-encapsulation-gre-tunnel-using-big-ip/289030
[imish-docs]: https://techdocs.f5.com/kb/en-us/products/big-ip_ltm/manuals/product/big-ip-tmos-routing-administration-14-0-0/11.html
[rfc5082]: https://datatracker.ietf.org/doc/html/rfc5082
[rfc6164]: https://datatracker.ietf.org/doc/html/rfc6164
