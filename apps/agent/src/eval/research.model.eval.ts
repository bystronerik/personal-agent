import { evalite } from 'evalite'

import { runResearch } from '../agent/research/agent'
import { syntheticNews } from '../fixtures/synthetic-news'
import { acrossModels, layerContext, reportingPerModel } from './models'
import { RESEARCH_SCORERS } from './scorers'

const LAYER = 'research'

evalite.each(acrossModels())(LAYER, {
  data: [{ input: syntheticNews }],
  task: reportingPerModel(LAYER, (briefInput, model) =>
    runResearch(layerContext(briefInput, model)),
  ),
  scorers: RESEARCH_SCORERS,
})
