# Vaubaan Gateway plugins — the catalog

Every published plugin of [Vaubaan Gateway](https://github.com/vaubaan/gateway), the ones an
instance preinstalls included, is declared here: one file per plugin under `catalog/`, naming its
source repository, the exact commit and its version. This repository holds no plugin code.

- **A pull request** that adds or changes a declaration is checked by `check`: the declarations are
  read, and each one it touches is **rebuilt from its declared commit** with the catalog's toolchain
  (`toolchain.json`, a commit of the gateway), without any secret. The job summary shows what the
  review reads: the version and commit before and after, the permissions of the risk catalog, the
  files of the archive.
- **On main**, `release` rebuilds every declaration that has no release yet, signs its manifest
  **keyless** (Sigstore public-good: the certificate names `.github/workflows/release.yml` of this
  repository on `main`), packs the archive and publishes it as the release `<id>-v<version>`. That
  signature is what a gateway shows as "signed by Vaubaan": built by this workflow from a reviewed
  commit. An archive submitted by its author is never signed here.
- **Building never holds the signature.** Building a plugin runs its code (its bundle is imported
  to check it), so `release` builds each plugin in a job of its own with a read-only token and no
  OIDC token. The job that signs runs no plugin code: it checks each built folder against its
  declaration and its manifest (`scripts/verify-built.mjs`: the declared id and version, every
  file listed with its sha256, nothing else beside them) before it signs and publishes.

Decisions: [plugin-catalog-rebuilt-from-source](https://github.com/vaubaan/gateway/blob/main/docs/decisions/plugin-catalog-rebuilt-from-source.md),
[plugin-signature-sets-the-trust-level](https://github.com/vaubaan/gateway/blob/main/docs/decisions/plugin-signature-sets-the-trust-level.md).

## Submit a plugin

1. Write it in your own repository with `@vaubaan/plugin-sdk` and check it (`vaubaan-plugin build`).
2. Open a pull request adding `catalog/<id>.yaml` (format in [`catalog/README.md`](catalog/README.md)).
3. A maintainer reviews the risk catalog and the classifier of the declared commit. A new version is a
   pull request changing `version` and `commit`.

## Rules

- A declaration is changed only by the owners it names (`CODEOWNERS`).
- The repository stays public: the public Sigstore log does not serve a private one.
- `toolchain.json` moves only by a reviewed pull request.
