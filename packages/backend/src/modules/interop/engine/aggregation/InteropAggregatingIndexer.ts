import type {
  InteropByChainPlugin,
  InteropByTokenIdPlugin,
  InteropPlainPlugin,
} from '@l2beat/config'
import type {
  AggregatedInteropTransferRecord,
  Database,
  InteropTransferRecord,
} from '@l2beat/database'
import { assert, UnixTime } from '@l2beat/shared-pure'
import groupBy from 'lodash/groupBy'
import type { InteropAggregationConfig } from '../../../../config/features/interop'
import {
  ManagedChildIndexer,
  type ManagedChildIndexerOptions,
} from '../../../../tools/uif/ManagedChildIndexer'

export interface InteropAggregatingIndexerDeps
  extends Omit<ManagedChildIndexerOptions, 'name'> {
  db: Database
  configs: InteropAggregationConfig[]
}

export class InteropAggregatingIndexer extends ManagedChildIndexer {
  constructor(private readonly $: InteropAggregatingIndexerDeps) {
    super({ ...$, name: 'interop_aggregating' })
  }

  override async update(_: number, to: number): Promise<number> {
    const from = to - UnixTime.DAY

    const transfers = await this.$.db.interopTransfer.getByRange(from, to)

    const aggregatedRecords: AggregatedInteropTransferRecord[] = []

    for (const config of this.$.configs) {
      const conditions = this.txMatchers(config)
      const filtered = transfers.filter((transfer) =>
        conditions.some((condition) => condition(transfer)),
      )
      const grouped = groupBy(
        filtered,
        (x) =>
          `${x.srcChain}-${x.dstChain}-${x.srcAbstractTokenId}-${x.dstAbstractTokenId}`,
      )

      for (const group of Object.values(grouped)) {
        aggregatedRecords.push({
          timestamp: to,
          id: config.id,
          ...this.mergeGroup(group),
        })
      }
    }

    this.$.db.transaction(async () => {
      await this.$.db.aggregatedInteropTransfer.deleteAll()
      await this.$.db.aggregatedInteropTransfer.insertMany(aggregatedRecords)
    })
    this.logger.info('Aggregated interop transfers saved to db', {
      aggregatedRecords: aggregatedRecords.length,
    })

    return to
  }

  // Invalidate everytime
  override invalidate(_: number): Promise<number> {
    return Promise.resolve(-1)
  }

  private mergeGroup(
    group: InteropTransferRecord[],
  ): Omit<AggregatedInteropTransferRecord, 'id' | 'timestamp'> {
    const first = group[0]
    assert(first, 'Group is empty')
    const merged: Omit<AggregatedInteropTransferRecord, 'id' | 'timestamp'> = {
      srcChain: first.srcChain,
      dstChain: first.dstChain,
      srcAbstractTokenId: first.srcAbstractTokenId,
      dstAbstractTokenId: first.dstAbstractTokenId,
      transferCount: group.length,
      totalDurationSum: 0,
      srcValueUsd: undefined,
      dstValueUsd: undefined,
    }
    for (const transfer of group) {
      merged.totalDurationSum += transfer.duration ?? 0
      if (transfer.srcValueUsd !== undefined) {
        merged.srcValueUsd = (merged.srcValueUsd ?? 0) + transfer.srcValueUsd
      }
      if (transfer.dstValueUsd !== undefined) {
        merged.dstValueUsd = (merged.dstValueUsd ?? 0) + transfer.dstValueUsd
      }
    }
    return merged
  }

  private txMatchers(config: InteropAggregationConfig) {
    const conditions: ((transfer: InteropTransferRecord) => boolean)[] = []
    const { plain, byChain, byTokenId } = this.groupPlugins(config)

    for (const plugin of plain) {
      conditions.push((transfer) => plugin.plugin === transfer.plugin)
    }

    for (const plugin of byChain) {
      conditions.push(
        (transfer) =>
          (plugin.chain === transfer.srcChain ||
            plugin.chain === transfer.dstChain) &&
          plugin.plugin === transfer.plugin,
      )
    }

    for (const plugin of byTokenId) {
      conditions.push(
        (transfer) =>
          (plugin.abstractTokenId === transfer.srcAbstractTokenId ||
            plugin.abstractTokenId === transfer.dstAbstractTokenId) &&
          plugin.plugin === transfer.plugin,
      )
    }

    return conditions
  }

  private groupPlugins(config: InteropAggregationConfig) {
    const plain: InteropPlainPlugin[] = []
    const byChain: InteropByChainPlugin[] = []
    const byTokenId: InteropByTokenIdPlugin[] = []

    for (const plugin of config.plugins) {
      switch (plugin.filterBy) {
        case 'chain':
          byChain.push(plugin)
          break
        case 'abstractTokenId':
          byTokenId.push(plugin)
          break
        default:
          plain.push(plugin)
          break
      }
    }

    return { plain, byChain, byTokenId }
  }
}
