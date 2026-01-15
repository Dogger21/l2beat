import { HourlyIndexer } from '../../../tools/HourlyIndexer'
import { IndexerService } from '../../../tools/uif/IndexerService'
import type { ApplicationModule, ModuleDependencies } from '../../types'
import { InteropAggregatingIndexer } from './aggregation/InteropAggregatingIndexer'

export function createInteropModule({
  config,
  db,
  logger,
  blockProcessors,
  clock,
  providers,
}: ModuleDependencies): ApplicationModule | undefined {
  if (!config.interop) {
    logger.info('Interop module disabled')
    return
  }
  logger = logger.tag({ feature: 'interop', module: 'interop' })

  const hourlyIndexer = new HourlyIndexer(logger, clock)

  if (!config.interop.aggregation) {
    return
  }

  const interopAggregatingIndexer = new InteropAggregatingIndexer({
    configs: config.interop.aggregation.configs,
    db,
    logger,
    indexerService: new IndexerService(db),
    parents: [hourlyIndexer],
    minHeight: 0,
  })

  const start = async () => {
    logger = logger.for('InteropModule')
    logger.info('Starting')
    await hourlyIndexer.start()
    await interopAggregatingIndexer.start()
    logger.info('Started')
  }

  return { routers: [], start }
}
