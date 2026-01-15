import { Logger } from '@l2beat/backend-tools'
import type { Database, InteropTransferRecord } from '@l2beat/database'
import { UnixTime } from '@l2beat/shared-pure'
import { expect, mockFn, mockObject } from 'earl'
import type { InteropAggregationConfig } from '../../../../config/features/interop'
import { mockDatabase } from '../../../../test/database'
import type { IndexerService } from '../../../../tools/uif/IndexerService'
import { _TEST_ONLY_resetUniqueIds } from '../../../../tools/uif/ids'
import { InteropAggregatingIndexer } from './InteropAggregatingIndexer'

describe(InteropAggregatingIndexer.name, () => {
  beforeEach(() => {
    _TEST_ONLY_resetUniqueIds()
  })

  describe(InteropAggregatingIndexer.prototype.update.name, () => {
    it('aggregates transfers and saves to database', async () => {
      const from = 100
      const to = 200
      const transfers: InteropTransferRecord[] = [
        createTransfer('across', 'msg1', 'deposit', UnixTime(150), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          duration: 5000,
          srcValueUsd: 2000,
          dstValueUsd: 2000,
        }),
        createTransfer('across', 'msg2', 'deposit', UnixTime(160), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          duration: 6000,
          srcValueUsd: 3000,
          dstValueUsd: 3000,
        }),
      ]

      const configs: InteropAggregationConfig[] = [
        {
          id: 'config1',
          bridgeType: 'canonical',
          plugins: [{ plugin: 'across' }],
        },
      ]

      const interopTransfer = mockObject<Database['interopTransfer']>({
        getByRange: mockFn().resolvesTo(transfers),
      })

      const aggregatedInteropTransfer = mockObject<
        Database['aggregatedInteropTransfer']
      >({
        deleteAll: mockFn().resolvesTo(0),
        insertMany: mockFn().resolvesTo(2),
      })

      const transaction = mockFn(async (fn: any) => await fn())

      const db = mockDatabase({
        transaction,
        interopTransfer,
        aggregatedInteropTransfer,
      })

      const indexer = new InteropAggregatingIndexer({
        db,
        configs,
        parents: [],
        indexerService: mockObject<IndexerService>({}),
        logger: Logger.SILENT,
        minHeight: 0,
      })

      const result = await indexer.update(from, to)

      expect(result).toEqual(to)
      expect(interopTransfer.getByRange).toHaveBeenCalledWith(
        UnixTime(to - UnixTime.DAY),
        UnixTime(to),
      )
      expect(transaction).toHaveBeenCalledTimes(1)
      expect(aggregatedInteropTransfer.deleteAll).toHaveBeenCalledTimes(1)

      expect(aggregatedInteropTransfer.insertMany).toHaveBeenCalledWith([
        {
          timestamp: UnixTime(to),
          id: 'config1',
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          transferCount: 2,
          totalDurationSum: 11000,
          srcValueUsd: 5000,
          dstValueUsd: 5000,
        },
      ])
    })

    it('filters transfers by plain plugin, chain plugin, and abstractTokenId plugin simultaneously', async () => {
      const to = 200
      const transfers: InteropTransferRecord[] = [
        // Plain plugin filter: across (should match config1)
        createTransfer('across', 'msg1', 'deposit', UnixTime(150), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          duration: 5000,
          srcValueUsd: 2000,
          dstValueUsd: 2000,
        }),
        createTransfer('stargate', 'msg2', 'deposit', UnixTime(160), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          duration: 6000,
          srcValueUsd: 3000,
          dstValueUsd: 3000,
        }),
        // Chain plugin filter: cctp-v1 with ethereum chain (should match config2)
        createTransfer('cctp-v1', 'msg3', 'deposit', UnixTime(170), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'usdc',
          dstAbstractTokenId: 'usdc',
          duration: 7000,
          srcValueUsd: 1000,
          dstValueUsd: 1000,
        }),
        createTransfer('cctp-v1', 'msg4', 'deposit', UnixTime(180), {
          srcChain: 'polygon',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'usdc',
          dstAbstractTokenId: 'usdc',
          duration: 8000,
          srcValueUsd: 1500,
          dstValueUsd: 1500,
        }),
        createTransfer('cctp-v1', 'msg5', 'deposit', UnixTime(190), {
          srcChain: 'arbitrum',
          dstChain: 'ethereum',
          srcAbstractTokenId: 'usdc',
          dstAbstractTokenId: 'usdc',
          duration: 9000,
          srcValueUsd: 2500,
          dstValueUsd: 2500,
        }),
        // AbstractTokenId plugin filter: stargate with eth token (should match config3)
        createTransfer('stargate', 'msg6', 'deposit', UnixTime(200), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          duration: 10000,
          srcValueUsd: 4000,
          dstValueUsd: 4000,
        }),
        createTransfer('stargate', 'msg7', 'deposit', UnixTime(210), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'usdc',
          dstAbstractTokenId: 'usdc',
          duration: 11000,
          srcValueUsd: 500,
          dstValueUsd: 500,
        }),
        createTransfer('stargate', 'msg8', 'deposit', UnixTime(220), {
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'usdc',
          duration: 12000,
          srcValueUsd: 3500,
          dstValueUsd: 3500,
        }),
      ]

      const configs: InteropAggregationConfig[] = [
        // Config1: Plain plugin filter - should match msg1 (across)
        {
          id: 'config1',
          bridgeType: 'canonical',
          plugins: [{ plugin: 'across' }],
        },
        // Config2: Chain plugin filter - should match msg3 (ethereum->arbitrum) and msg5 (arbitrum->ethereum)
        {
          id: 'config2',
          bridgeType: 'canonical',
          plugins: [
            { filterBy: 'chain', chain: 'ethereum', plugin: 'cctp-v1' },
          ],
        },
        // Config3: AbstractTokenId plugin filter - should match msg6 (eth->eth) and msg8 (eth->usdc, src is eth)
        {
          id: 'config3',
          bridgeType: 'canonical',
          plugins: [
            {
              filterBy: 'abstractTokenId',
              abstractTokenId: 'eth',
              plugin: 'stargate',
            },
          ],
        },
      ]

      const interopTransfer = mockObject<Database['interopTransfer']>({
        getByRange: mockFn().resolvesTo(transfers),
      })

      const aggregatedInteropTransfer = mockObject<
        Database['aggregatedInteropTransfer']
      >({
        deleteAll: mockFn().resolvesTo(0),
        insertMany: mockFn().resolvesTo(5),
      })

      const transaction = mockFn(async (fn: any) => await fn())

      const db = mockDatabase({
        interopTransfer,
        aggregatedInteropTransfer,
        transaction,
      })

      const indexer = new InteropAggregatingIndexer({
        db,
        configs,
        parents: [],
        indexerService: mockObject<IndexerService>({}),
        logger: Logger.SILENT,
        minHeight: 0,
      })

      await indexer.update(0, to)

      expect(aggregatedInteropTransfer.insertMany).toHaveBeenCalledWith([
        // Config1: Plain plugin filter - should match msg1 (across)
        {
          timestamp: UnixTime(to),
          id: 'config1',
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          transferCount: 1,
          totalDurationSum: 5000,
          srcValueUsd: 2000,
          dstValueUsd: 2000,
        },
        // Config2: Chain plugin filter - should match msg3 (ethereum->arbitrum)
        {
          timestamp: UnixTime(to),
          id: 'config2',
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'usdc',
          dstAbstractTokenId: 'usdc',
          transferCount: 1,
          totalDurationSum: 7000,
          srcValueUsd: 1000,
          dstValueUsd: 1000,
        },
        // Config2: Chain plugin filter - should match msg5 (arbitrum->ethereum)
        {
          timestamp: UnixTime(to),
          id: 'config2',
          srcChain: 'arbitrum',
          dstChain: 'ethereum',
          srcAbstractTokenId: 'usdc',
          dstAbstractTokenId: 'usdc',
          transferCount: 1,
          totalDurationSum: 9000,
          srcValueUsd: 2500,
          dstValueUsd: 2500,
        },
        // Config3: AbstractTokenId plugin filter - should match msg6 (eth->eth)
        {
          timestamp: UnixTime(to),
          id: 'config3',
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'eth',
          transferCount: 2,
          totalDurationSum: 16000,
          srcValueUsd: 7000,
          dstValueUsd: 7000,
        },
        // Config3: AbstractTokenId plugin filter - should match msg8 (eth->usdc)
        {
          timestamp: UnixTime(to),
          id: 'config3',
          srcChain: 'ethereum',
          dstChain: 'arbitrum',
          srcAbstractTokenId: 'eth',
          dstAbstractTokenId: 'usdc',
          transferCount: 1,
          totalDurationSum: 12000,
          srcValueUsd: 3500,
          dstValueUsd: 3500,
        },
      ])
    })
  })

  describe(InteropAggregatingIndexer.prototype.invalidate.name, () => {
    it('returns 0', async () => {
      const indexer = new InteropAggregatingIndexer({
        db: mockDatabase(),
        configs: [],
        parents: [],
        indexerService: mockObject<IndexerService>({}),
        logger: Logger.SILENT,
        minHeight: 0,
      })

      const result = await indexer.invalidate(100)

      expect(result).toEqual(0)
    })
  })
})

function createTransfer(
  plugin: string,
  transferId: string,
  type: string,
  timestamp: UnixTime,
  overrides?: Partial<InteropTransferRecord>,
): InteropTransferRecord {
  return {
    plugin,
    transferId,
    type,
    timestamp,
    duration: undefined,
    srcTime: undefined,
    srcChain: undefined,
    srcTxHash: undefined,
    srcLogIndex: undefined,
    srcEventId: undefined,
    srcTokenAddress: undefined,
    srcRawAmount: undefined,
    srcWasBurned: undefined,
    srcAbstractTokenId: undefined,
    srcSymbol: undefined,
    srcAmount: undefined,
    srcPrice: undefined,
    srcValueUsd: undefined,
    dstTime: undefined,
    dstChain: undefined,
    dstTxHash: undefined,
    dstLogIndex: undefined,
    dstEventId: undefined,
    dstTokenAddress: undefined,
    dstRawAmount: undefined,
    dstWasMinted: undefined,
    dstAbstractTokenId: undefined,
    dstSymbol: undefined,
    dstAmount: undefined,
    dstPrice: undefined,
    dstValueUsd: undefined,
    isProcessed: false,
    ...overrides,
  }
}
