// Balance knobs. These are gameplay defaults, not real toxicology or spawn guarantees.
export const CONFIG = Object.freeze({
  npcType:'pinene:mushroom_appraiser',
  naturalTokenKey:'pinene:myco_natural_token',
  leaseKey:'pinene:myco_appraiser_lease_v1',
  spawnClockKey:'pinene:myco_spawn_minutes_v1',
  spawnIntervalMinutes:15,
  normalChance:0.04,
  islandChance:0.20,
  normalLifetimeMs:30*60*1000,
  islandLifetimeMs:45*60*1000,
  maxGraceMs:5*60*1000,
  spawnRadiusMin:24,
  spawnRadiusMax:48,
  spawnAttempts:16,
  interactionDistance:8,
  naturalSpawningEnabled:true,
  // Bedrock uses mushroom_island, not Java's mushroom_fields. Tag is preferred.
  islandBiomeIds:['minecraft:mushroom_island','minecraft:mushroom_island_shore','mushroom_island','mushroom_island_shore'],
  islandBiomeTags:['mooshroom_island'],
  poisonQueueKey:'pinene:myco_poison_queue_v1',
  receiptKey:'pinene:myco_appraisal_receipt_v1',
  researchPointsKey:'pinene:myco_research_points_v1',
  // Reserved points are not granted yet: research/cooking/potions remain out of scope.
  grantResearchPoints:false,
});
