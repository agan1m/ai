const model = require('./model/index');
const entityTypes = require('./model/entity-type');
const AttackAction = require('./model/attack-action');
const AutoAttackAction = require('./model/auto-attack');
const EntityAction = require('./model/entity-action');
const BuildAction = require('./model/build-action');
const MoveAction = require('./model/move-action');
const RepairAction = require('./model/repair-action');

const Vec2Int = require('./model/vec2-int');

let myPosition = null;
const WAYS = [{x: 80, y: 80}, {x: 0, y: 80}, {x: 80, y: 0}];

class MyStrategy {
    async getAction(playerView, debugInterface) {
        const BUILDERS_TYPES = [entityTypes.BuilderBase, entityTypes.RangedBase, entityTypes.MeleeBase, entityTypes.House];
        const UNIT_TYPES = [entityTypes.BuilderUnit, entityTypes.MeleeUnit, entityTypes.RangedUnit];
        let myMaxPopulation = 0;
        let myPopulation = 0;

        const actions = new Map();
        const myId = playerView.myId;
        const my = playerView.players.find(p => p.id === myId);
        const resources = my.resource;
        const entities = playerView.entities;
        const myEntities = entities.filter(i => i.playerId === myId);
        const builders = myEntities.filter(i => BUILDERS_TYPES.indexOf(i.entityType) > -1);
        myEntities.filter(i => UNIT_TYPES.indexOf(i.entityType) > -1).forEach(u => myPopulation += playerView.entityProperties.get(u.entityType).populationUse);
        builders.forEach(b => {
            if (!myPopulation && b.entityType === entityTypes.BuilderBase) {
                myPosition = b.position;
            }
            myMaxPopulation += playerView.entityProperties.get(b.entityType).populationProvide;
        });

        const workers = myEntities.filter(e => e.entityType === entityTypes.BuilderUnit);
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
                    new MoveAction(new Vec2Int(80, 80), true, true),
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
                actions.set(entity.id, new EntityAction(
                    new MoveAction(new Vec2Int(80, 80), true, true),
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
        const y = entity.position.y - size > playerView.mapSize ? entity.position.y + 1 : entity.position.y - 1;
        const x = entity.position.x + size > playerView.mapSize ? entity.position.x - 1 : entity.position.x + 1;

        //return new BuildAction(entityTypes.House, new Vec2Int(x, y))
        return new BuildAction(entityTypes.House, new Vec2Int(entity.position.x - 1, entity.position.y + 1))
    } else if (needRangeBase) {
        return new BuildAction(entityTypes.RangedBase, new Vec2Int(entity.position.x + 1, entity.position.y - 1))
    } else {
        return null;
    }
}

module.exports.MyStrategy = MyStrategy;
