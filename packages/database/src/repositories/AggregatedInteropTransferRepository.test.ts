import { UnixTime } from '@l2beat/shared-pure'
import { expect } from 'earl'
import { describeDatabase } from '../test/database'
import {
  type AggregatedInteropTransferRecord,
  AggregatedInteropTransferRepository,
} from './AggregatedInteropTransferRepository'

describeDatabase(AggregatedInteropTransferRepository.name, (db) => {
  const repository = db.aggregatedInteropTransfer

  beforeEach(async () => {
    await repository.deleteAll()
  })

  describe(
    AggregatedInteropTransferRepository.prototype.insertMany.name,
    () => {
      it('adds new rows', async () => {
        const records = [
          record('id1', UnixTime(100), 'ethereum', 'arbitrum', 5, 1000),
          record('id2', UnixTime(200), 'arbitrum', 'ethereum', 3, 2000),
        ]

        const inserted = await repository.insertMany(records)
        expect(inserted).toEqual(2)

        const result = await repository.getAll()
        expect(result).toEqualUnsorted(records)
      })

      it('handles empty array', async () => {
        const inserted = await repository.insertMany([])
        expect(inserted).toEqual(0)

        const result = await repository.getAll()
        expect(result).toEqual([])
      })

      it('performs batch insert when more than 1000 records', async () => {
        const records = []
        for (let i = 0; i < 1500; i++) {
          records.push(
            record(`id${i}`, UnixTime(i), 'ethereum', 'arbitrum', 1, 100),
          )
        }

        const inserted = await repository.insertMany(records)
        expect(inserted).toEqual(1500)

        const result = await repository.getAll()
        expect(result).toHaveLength(1500)
      })
    },
  )

  describe(AggregatedInteropTransferRepository.prototype.getAll.name, () => {
    it('returns empty array when no records exist', async () => {
      const result = await repository.getAll()
      expect(result).toEqual([])
    })

    it('returns all records', async () => {
      const records = [
        record('id1', UnixTime(100), 'ethereum', 'arbitrum', 5, 1000),
        record('id2', UnixTime(200), 'arbitrum', 'ethereum', 3, 2000),
        record('id3', UnixTime(300), 'polygon', 'ethereum', 7, 3000),
      ]

      await repository.insertMany(records)

      const result = await repository.getAll()
      expect(result).toEqualUnsorted(records)
    })
  })
})

function record(
  id: string,
  timestamp: UnixTime,
  srcChain?: string,
  dstChain?: string,
  transferCount = 1,
  totalDurationSum = 0,
  srcAbstractTokenId?: string,
  dstAbstractTokenId?: string,
  srcValueUsd?: number,
  dstValueUsd?: number,
): AggregatedInteropTransferRecord {
  return {
    timestamp,
    id,
    srcChain,
    dstChain,
    srcAbstractTokenId,
    dstAbstractTokenId,
    transferCount,
    totalDurationSum,
    srcValueUsd,
    dstValueUsd,
  }
}
