const fs = require('fs');
const KP = 5; // attractive potential gain
const ETA = 100;  // repulsive potential gain
const AREA_WIDTH = 80;  // potential area width [m]
// the number of previous positions used to check oscillations
const OSCILLATIONS_DETECTION_LENGTH = 3;
var test = 1;

function range(num) {
    let arr = [];
    for (let i = 0; i < num; i++) {
        arr.push(i);
    }

    return arr;
}

function calcPotentialField(gx, gy, ox, oy, reso, rr, sx, sy) {
    const minx = Math.min(Math.min(...ox), sx, gx) - AREA_WIDTH / 2;
    const miny = Math.min(Math.min(...oy), sy, gy) - AREA_WIDTH / 2;
    const maxx = Math.max(Math.max(...ox), sx, gx) + AREA_WIDTH / 2;
    const maxy = Math.max(Math.max(...oy), sy, gy) + AREA_WIDTH / 2;
    const xw = Number(Math.round((maxx - minx) / reso));
    const yw = Number(Math.round((maxy - miny) / reso));

    const xxxx = new Array(xw).fill(0);
    let pmap = new Array(yw).fill(xxxx);

    for (let ix of range(xw)) {
        let x = ix * reso + minx;
        for (let iy of range(yw)) {
            let y = iy * reso + miny;
            let ug = calcAttractivePotential(x, y, gx, gy);
            let uo = calcRepulsivePotential(x, y, ox, oy, rr);
            let uf = ug + uo;

            pmap[ix][iy] = uf;
        }
    }
    return {pmap, minx, miny};
}

function calcAttractivePotential(x, y, gx, gy) {
    return 0.5 * KP * Math.hypot(x - gx, y - gy);
}


function calcRepulsivePotential(x, y, ox, oy, rr) {
// search nearest obstacle
    let minid = -1;
    let dmin = Infinity;
    ox.forEach((_, i) => {
        let d = Math.hypot(x - ox[i], y - oy[i]);
        if (dmin >= d) {
            dmin = d;
            minid = i;
        }
    });
    // calc repulsive potential
    let dq = Math.hypot(x - ox[minid], y - oy[minid]);

    if (dq <= rr) {
        if (dq <= 0.1) {
            dq = 0.1;
        }
        return Math.pow(0.5 * ETA * (1.0 / dq - 1.0 / rr), 2);
    } else {
        return 0.0;
    }
}

function getMotionModel() {
    // dx, dy
    // const motion = [[1, 0],
    //     [0, 1],
    //     [-1, 0],
    //     [0, -1],
    //     [-1, -1],
    //     [-1, 1],
    //     [1, -1],
    //     [1, 1]];
    const motion = [[1, 0],
        [0, 1],
        [-1, 0],
        [0, -1]];

    return motion;
}


function oscillationsDetection(previous_ids, ix, iy) {
    previous_ids.push(`x${ix}y${iy}`);

    if (previous_ids.length > OSCILLATIONS_DETECTION_LENGTH) {
        previous_ids.shift();
    }

// check if contains any duplicates by copying into a set
    const previous_ids_set = new Set(previous_ids);
    for (let index of previous_ids) {
        if (previous_ids_set.has(index)) {
            return true;
        } else {
            previous_ids_set.add(index);
        }
    }
    return false;
}


function potentialFieldPlanning(sx, sy, gx, gy, ox, oy, reso, rr) {

// calc potential field
    let {pmap, minx, miny} = calcPotentialField(gx, gy, ox, oy, reso, rr, sx, sy);
    // search path
    let d = Math.hypot(sx - gx, sy - gy);
    let ix = Math.round((sx - minx) / reso);
    let iy = Math.round((sy - miny) / reso);

    let rx = [sx];
    let ry = [sy];
    const motion = getMotionModel();
    let previous_ids = [];

    while (d >= reso) {
        let minp = Infinity;
        let minix = -1;
        let miniy = -1;
        let p;
        //console.log(pmap);
        for (let i = 0; i < motion.length; i++) {
            let inx = Number(ix + motion[i][0]);
            let iny = Number(iy + motion[i][1]);
            if (inx >= pmap.length || iny >= pmap[0].length || inx < 0 || iny < 0) {
                p = Infinity;
                // outside area
                console.log("outside potential!");
            } else {
                p = pmap[inx][iny]
            }
            if (minp > p) {
                minp = p;
                minix = inx;
                miniy = iny;
            }
            ix = minix;
            iy = miniy;
            let xp = ix * reso + minx;
            let yp = iy * reso + miny;
            d = Math.hypot(gx - xp, gy - yp);
            rx.push(xp);
            ry.push(yp);
            if(rx.length >= 2) {
                break;
            }
        }
        if (rx.length >= 2) {
            break;
        }
        if (oscillationsDetection(previous_ids, ix, iy)) {
            console.log("Oscillation detected at ({},{})!", ix, iy);
            break;
        }
    }

    console.log("Goal!!");
    console.log(rx, ry);
    return {rx, ry}
}

module.exports = potentialFieldPlanning;

