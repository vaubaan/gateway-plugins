# Declarations

One file per plugin, `<id>.yaml`, named after its id:

```yaml
id: crm
repo: https://github.com/acme/vaubaan-plugin-crm
path: .                  # the plugin's folder in that repository (default: the root)
version: 0.2.0
commit: 3f9a1c2e7b…      # the full sha the catalog builds
owners: [acme-dev]       # GitHub users or org/teams who may change this file
```

`node scripts/declarations.mjs check` reads them all.

The official plugins, the ones an instance preinstalls among them, are declared here like any
other: their source is `vaubaan/gateway`, under `plugins/<id>`, owned by `vaubaan/maintainers`.
