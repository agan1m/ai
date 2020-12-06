const model = require('./model/index');
const entityTypes = require('./model/entity-type');
const AttackAction = require('./model/attack-action');
const AutoAttackAction = require('./model/auto-attack');
const EntityAction = require('./model/entity-action');
const BuildAction = require('./model/build-action');
const MoveAction = require('./model/move-action');
const RepairAction = require('./model/repair-action');

const Vec2Int = require('./model/vec2-int');

const findWays = require('./findWays');
const potencialFields = require('./potentialFields');

let myPosition = null;
const WAYS = {};

class MyStrategy {
    async getAction(playerView, debugInterface) {
        const BUILDERS_TYPES = [entityTypes.BuilderBase, entityTypes.RangedBase, entityTypes.MeleeBase, entityTypes.House];
        const UNIT_TYPES = [entityTypes.BuilderUnit, entityTypes.MeleeUnit, entityTypes.RangedUnit];
        let myMaxPopulation = 0;
        let myPopulation = 0;


        const findWaysObj = findWays();
        let map = createMap(playerView.mapSize);
        // playerView.currentTick === 1 && console.log(map);
        const actions = new Map();
        const myId = playerView.myId;
        const my = playerView.players.find(p => p.id === myId);
        const resources = my.resource;
        const entities = playerView.entities;
        let resourcePosition = [[], []];
        let myEntities = [];
        let builders = [];
        let units = [];
        entities.forEach(e => {
            if (e.entityType === entityTypes.Resource) {
                resourcePosition[0].push(e.position.x);
                resourcePosition[1].push(e.position.y);
                map[e.position.y][e.position.x] = 0;
            }
            if (e.playerId === myId) {
                myEntities.push(e);
            }
            if (e.playerId === myId && BUILDERS_TYPES.indexOf(e.entityType) > -1) {
                builders.push(e);
            }
            if (e.playerId === myId && UNIT_TYPES.indexOf(e.entityType) > -1) {
                units.push(e);
                myPopulation += playerView.entityProperties.get(e.entityType).populationUse;
            }

        });
        const graph = new findWaysObj.Graph(map);

        playerView.currentTick === 1 && console.log(graph.toString());
        //const myEntities = entities.filter(i => i.playerId === myId);
        //const builders = myEntities.filter(i => BUILDERS_TYPES.indexOf(i.entityType) > -1);
        //myEntities.filter(i => UNIT_TYPES.indexOf(i.entityType) > -1).forEach(u => myPopulation += playerView.entityProperties.get(u.entityType).populationUse);
        builders.forEach(b => {
            if (!myPopulation && b.entityType === entityTypes.BuilderBase) {
                myPosition = b.position;
            }
            myMaxPopulation += playerView.entityProperties.get(b.entityType).populationProvide;
        });

        const workers = units.filter(e => e.entityType === entityTypes.BuilderUnit);
        const builderCost = playerView.entityProperties.get(entityTypes.BuilderUnit).cost;
        const meleeUnitCost = playerView.entityProperties.get(entityTypes.MeleeUnit).cost;
        const rangeUnitCost = playerView.entityProperties.get(entityTypes.RangedUnit).cost;

        for (let entity of myEntities) {
            const properties = playerView.entityProperties.get(entity.entityType);

            if (entity.entityType === entityTypes.BuilderUnit) {
                const needHouse = myPopulation + 3 >= myMaxPopulation;
                const needRangeBase = resources > 500;
                const needRepair = builders.find(b => playerView.entityProperties.get(b.entityType).maxHealth > b.health);

                actions.set(entity.id, new EntityAction(
                    null,
                    needBuilding(playerView, entity, needHouse, needRangeBase),
                    !needRepair ? new AttackAction(
                        null,
                        new AutoAttackAction(
                            playerView.mapSize,
                            [entityTypes.Resource]
                        )) : null,
                    needRepair ? new RepairAction(needRepair.id) : null
                    )
                );
            }
            if (entity.entityType === entityTypes.MeleeUnit) {
                actions.set(entity.id, new EntityAction(
                    null, //new MoveAction(new Vec2Int(80, 80), true, true),
                    null,
                    new AttackAction(
                        null,
                        new AutoAttackAction(
                            playerView.entityProperties.get(entityTypes.MeleeUnit).sightRange,
                            [entityTypes.MeleeUnit, entityTypes.RangedUnit]
                        )),
                    null
                    )
                );
            }
            if (entity.entityType === entityTypes.RangedUnit) {
                if (!WAYS[entity.id]) {
                    WAYS[entity.id] = findWaysObj.astar.search(graph, graph.grid[entity.position.x][entity.position.y], graph.grid[79][79]);
                }
                const point = WAYS[entity.id].shift();

                actions.set(entity.id, new EntityAction(
                    //new MoveAction(new Vec2Int(80, 80), true, true),
                    point ? new MoveAction(new Vec2Int(point.x, point.y), false, false) : null,
                    null,
                    new AttackAction(
                        null,
                        new AutoAttackAction(
                            playerView.entityProperties.get(entityTypes.RangedUnit).sightRange,
                            [entityTypes.MeleeUnit, entityTypes.RangedUnit]
                        )),
                    null
                    )
                );
            }
            if (entity.entityType === entityTypes.BuilderBase) {
                const needBuilder = entity.active && resources >= builderCost && workers.length <= 8;
                actions.set(entity.id, new EntityAction(
                    null,
                    needBuilder ? new BuildAction(entityTypes.BuilderUnit, new Vec2Int(entity.position.x + 1, entity.position.y - 1)) : null,
                    null,
                    null
                    )
                );
            }
            if (entity.entityType === entityTypes.MeleeBase) {
                const needMelee = resources > 500;
                actions.set(entity.id, new EntityAction(
                    null,
                    needMelee ? new BuildAction(entityTypes.MeleeUnit, new Vec2Int(entity.position.x + 1, entity.position.y - 1)) : null,
                    null,
                    null
                    )
                );
            }
            if (entity.entityType === entityTypes.RangedBase) {
                const needRange = true;
                actions.set(entity.id, new EntityAction(
                    null,
                    needRange ? new BuildAction(entityTypes.RangedUnit, new Vec2Int(entity.position.x + 1, entity.position.y - 1)) : null,
                    null,
                    null
                    )
                );
            }
            if (entity.entityType === entityTypes.Turret) {
                actions.set(entity.id, new EntityAction(
                    null,
                    null,
                    new AttackAction(
                        null,
                        new AutoAttackAction(
                            playerView.entityProperties.get(entityTypes.Turret).sightRange,
                            [entityTypes.MeleeUnit, entityTypes.RangedUnit]
                        )),
                    null
                    )
                );
            }
        }

        return new model.Action(actions);
    }

    async debugUpdate(playerView, debugInterface) {
        await debugInterface.send(new model.DebugCommand.Clear());
        await debugInterface.getState();
    }
}

function needBuilding(playerView, entity, needHouse, needRangeBase) {
    if (needHouse) {
        const size = playerView.entityProperties.get(entityTypes.House).size;
        let x;
        let y;
        if (entity.position.y - 1 - size > 0 && entity.position.x - 1 - size > 0) {
            y = entity.position.y - 1;
            x = entity.position.x - 1;
        } else if (entity.position.y + 1 + size < playerView.mapSize && entity.position.x + 1 + size < playerView.mapSize) {
            y = entity.position.y + 1;
            x = entity.position.x + 1;
        }
        //const y = entity.position.y - size > playerView.mapSize ? entity.position.y + 1 : entity.position.y - 1;
        //const x = entity.position.x + size > playerView.mapSize ? entity.position.x - 1 : entity.position.x + 1;

        // return new BuildAction(entityTypes.House, new Vec2Int(x, y));
        return new BuildAction(entityTypes.House, new Vec2Int(x, y))
    } else if (needRangeBase) {
        return new BuildAction(entityTypes.RangedBase, new Vec2Int(entity.position.x + 1, entity.position.y - 1))
    } else {
        return null;
    }
}

function createMap(mapSize) {
    const x = new Array(mapSize).fill(1);
    const map = [];
    for (let i = 0; i < mapSize; i++) {
        map[i] = [...x];
    }
    return map;
}

module.exports.MyStrategy = MyStrategy;
