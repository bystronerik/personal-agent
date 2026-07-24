import { evalite } from 'evalite'

import { runResearch } from '../agent/research/agent'
import { syntheticNews } from '../fixtures/synthetic-news'
import { acrossModels, layerContext } from './models'
import { RESEARCH_SCORERS } from './scorers'

evalite.each(acrossModels())('research', {
  data: [{ input: syntheticNews }],
  task: (briefInput, model) => runResearch(layerContext(briefInput, model)),
  scorers: RESEARCH_SCORERS,
})
