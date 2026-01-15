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

  describe(
    AggregatedInteropTransferRepository.prototype.deleteBefore.name,
    () => {
      it('deletes records before timestamp and returns count', async () => {
        const record1 = record(
          'id1',
          UnixTime(100),
          'ethereum',
          'arbitrum',
          5,
          1000,
        )
        const record2 = record(
          'id2',
          UnixTime(200),
          'arbitrum',
          'ethereum',
          3,
          2000,
        )
        const record3 = record(
          'id3',
          UnixTime(300),
          'polygon',
          'ethereum',
          7,
          3000,
        )
        const records = [record1, record2, record3]

        await repository.insertMany(records)

        const deleted = await repository.deleteBefore(UnixTime(250))
        expect(deleted).toEqual(2)

        const remaining = await repository.getAll()
        expect(remaining).toEqualUnsorted([record3])
      })

      it('returns 0 when no records before timestamp', async () => {
        await repository.insertMany([
          record('id1', UnixTime(200), 'ethereum', 'arbitrum', 5, 1000),
          record('id2', UnixTime(300), 'arbitrum', 'ethereum', 3, 2000),
        ])

        const deleted = await repository.deleteBefore(UnixTime(100))
        expect(deleted).toEqual(0)

        const remaining = await repository.getAll()
        expect(remaining).toHaveLength(2)
      })

      it('returns 0 when no records exist', async () => {
        const deleted = await repository.deleteBefore(UnixTime(100))
        expect(deleted).toEqual(0)
      })

      it('does not delete records with equal timestamp', async () => {
        const record1 = record(
          'id1',
          UnixTime(100),
          'ethereum',
          'arbitrum',
          5,
          1000,
        )
        const record2 = record(
          'id2',
          UnixTime(200),
          'arbitrum',
          'ethereum',
          3,
          2000,
        )
        const records = [record1, record2]

        await repository.insertMany(records)

        const deleted = await repository.deleteBefore(UnixTime(200))
        expect(deleted).toEqual(1)

        const remaining = await repository.getAll()
        expect(remaining).toEqualUnsorted([record2])
      })
    },
  )

  describe(
    AggregatedInteropTransferRepository.prototype.deleteByTimestamp.name,
    () => {
      it('deletes records with matching timestamp and returns count', async () => {
        const record1 = record(
          'id1',
          UnixTime(100),
          'ethereum',
          'arbitrum',
          5,
          1000,
        )
        const record2 = record(
          'id2',
          UnixTime(200),
          'arbitrum',
          'ethereum',
          3,
          2000,
        )
        const record3 = record(
          'id3',
          UnixTime(200),
          'polygon',
          'ethereum',
          7,
          3000,
        )
        const record4 = record(
          'id4',
          UnixTime(300),
          'ethereum',
          'polygon',
          2,
          4000,
        )
        const records = [record1, record2, record3, record4]

        await repository.insertMany(records)

        const deleted = await repository.deleteByTimestamp(UnixTime(200))
        expect(deleted).toEqual(2)

        const remaining = await repository.getAll()
        expect(remaining).toEqualUnsorted([record1, record4])
      })

      it('returns 0 when no records match timestamp', async () => {
        await repository.insertMany([
          record('id1', UnixTime(100), 'ethereum', 'arbitrum', 5, 1000),
          record('id2', UnixTime(200), 'arbitrum', 'ethereum', 3, 2000),
        ])

        const deleted = await repository.deleteByTimestamp(UnixTime(300))
        expect(deleted).toEqual(0)

        const remaining = await repository.getAll()
        expect(remaining).toHaveLength(2)
      })

      it('returns 0 when no records exist', async () => {
        const deleted = await repository.deleteByTimestamp(UnixTime(100))
        expect(deleted).toEqual(0)
      })

      it('deletes only records with exact timestamp match', async () => {
        const record1 = record(
          'id1',
          UnixTime(100),
          'ethereum',
          'arbitrum',
          5,
          1000,
        )
        const record2 = record(
          'id2',
          UnixTime(200),
          'arbitrum',
          'ethereum',
          3,
          2000,
        )
        const record3 = record(
          'id3',
          UnixTime(300),
          'polygon',
          'ethereum',
          7,
          3000,
        )
        const records = [record1, record2, record3]

        await repository.insertMany(records)

        const deleted = await repository.deleteByTimestamp(UnixTime(200))
        expect(deleted).toEqual(1)

        const remaining = await repository.getAll()
        expect(remaining).toEqualUnsorted([record1, record3])
      })
    },
  )
})

function record(
  id: string,
  timestamp: UnixTime,
  srcChain: string,
  dstChain: string,
  transferCount = 1,
  totalDurationSum = 0,
  srcValueUsd?: number,
  dstValueUsd?: number,
  tokensByVolume: Record<string, number> = {},
): AggregatedInteropTransferRecord {
  return {
    timestamp,
    id,
    srcChain,
    dstChain,
    transferCount,
    totalDurationSum,
    srcValueUsd,
    dstValueUsd,
    tokensByVolume,
  }
}
