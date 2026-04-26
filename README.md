# acrux

> **Programmable paywall for AI agents.** Drop-in Lightning Network middleware that protects any HTTP API with per-load surge pricing, per-wallet attacker pricing, and reputation staking with slashing.

Built for [HackNation Challenge #02](https://hacknation.io) — *Earn in the Agent Economy*, sponsored by [Spiral](https://spiral.xyz) / Block.

## Documentation

- [Overview and Primitives](docs/overview.md)
- [Architecture](docs/architecture.md)
- [Quickstart](docs/quickstart.md)
- [API Reference](docs/api.md)
- [Demo: Dueling Bots](docs/demo.md)
- [Deployment](docs/deployment.md)

## Try it in 30 seconds

```bash
# Free price quote — read the live surge multiplier
curl https://acrux.pro/api/price

# Paywalled ping — returns 402 + Lightning invoice on first hit
curl -i https://acrux.pro/api/ping
```

## License

MIT.
