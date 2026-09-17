# contracts/

**This is the only place domains are allowed to see each other.**

Everything in here is a type, an interface, or a tiny pure helper. No
implementation, no three.js scene graph work, no DOM.

The point: `world/` and `cockpit/` and `ui/` never import one another. They
each import contracts, and the composition root in `app/` wires the real
implementations together at runtime. So a change inside `world/` cannot break
`ui/`, because `ui/` has never seen `world/`.

## Changing a contract is a coordination event

A change here is the one kind of change that can break another domain's build.
Treat it accordingly:

- Adding a new optional field or a new event: safe, go ahead.
- Changing or removing an existing member: say so in `docs/PROGRESS.md`, and
  check every consumer in the same commit.
- Adding a whole new service: add it to `Services` and note who provides it.

If you find yourself wanting to import another domain directly to get at
something, that is the signal that a contract is missing. Add the contract.
