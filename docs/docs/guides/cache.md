---
sidebar_position: 4

title: Local caching
---

`lage` by default will cache recent task results locally on disk. As long as the source file and the command arguments have not changed, those cached results will be restored.

See [remote cache](./remote-cache.md) for details about speeding up local dev environment even further with a remote cache from Continuous Integration jobs.

## Turn off cache

Sometimes, this incremental behavior is not desired. You can override the caching behavior by using the `--no-cache` argument.

```
lage build --no-cache
```

## Resetting cache

Once in a while, the cache might need to be recreated from scratch. In those situations, you can reset the cache by passing in the `--reset-cache` argument to the command line.

```
lage build --reset-cache
```

## Cache Options

Caching capability is provided by `backfill`. All of the configuration under the `cacheOptions` key is passed to `backfill`. For the complete documentation of `cacheOptions`, see the [`backfill` configuration documentation](https://github.com/microsoft/backfill#configuration).
