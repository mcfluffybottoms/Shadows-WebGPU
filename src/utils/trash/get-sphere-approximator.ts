import * as THREE from 'three/webgpu';

type Sphere = {
    center: THREE.Vector3,
    radius: number
}

type ApproxedGeometry = Sphere[];

const VOXEL_RESOLUTION = 10.0;

/*
    Building an 
*/
const NUM_SPHERES: number = 32;
const MAX_ITER: number = 2;

function getApproximatedGeometry(obj: THREE.Mesh): ApproxedGeometry {
    const pointSet = getPointSet(obj);
    const points = [...pointSet.interiorPoints, ...pointSet.surfacePoints];

    let energy = Infinity;
    const spheres = initSpheres(points, NUM_SPHERES);
    for (let iter = 0; iter < MAX_ITER; iter++) {
        console.log(`Iteration ${iter + 1}/${MAX_ITER}`);
        let clusters = pointClustering(points, spheres, obj);
        updateClusterSpheres(points, clusters, obj);

        const newEnergy = getTotalEnergy(clusters, obj);
    
        console.log(`  Energy: ${newEnergy.toFixed(4)} (Δ = ${(energy - newEnergy).toFixed(4)})`);
        if (Math.abs(energy - newEnergy) < 1e-6) {
            console.log('Converged.');
            break;
        }

        energy = newEnergy;
    }

    return spheres;
}

function getTotalEnergy(clusters: Cluster[], obj: THREE.Mesh): number {
    let total = 0;
    for (const cluster of clusters) {
        total += getOutsideVolume(cluster.sphere, obj);
    }
    return total;
}

/*
    Helper functions
*/
function isPointInsideMesh(point: THREE.Vector3, obj: THREE.Mesh): boolean {
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(1, 0, 0);
    raycaster.set(point, direction);
    const intersects = raycaster.intersectObject(obj);
    return intersects.length % 2 === 1;
}


function shuffleArray<Type>(array: Type[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getNeighbors(
    points: THREE.Vector3[],
    point: THREE.Vector3,
    k: number
) {
    let ps = [...points];
    ps.sort((a, b) => {
        const d1 = point.distanceTo(a);
        const d2 = point.distanceTo(b);
        return d1 - d2;
    });

    return ps.slice(0, k);
}

function computeBoundingRadius(center: THREE.Vector3, points: THREE.Vector3[]) {
    let maxDist = -Infinity;

    for (let i = 0; i < points.length; i++) {
        const dist = center.distanceTo(points[i]);
        if (maxDist < dist) {
            maxDist = dist;
        }
    }

    return maxDist;
}

/*
    (0) Get points
*/
type PointSet = {
    surfacePoints: THREE.Vector3[],
    interiorPoints: THREE.Vector3[],
}

export function getSurfacePoints(
    mesh: THREE.Mesh
) {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    const points = [];

    for (let i = 0; i < positions.array.length; ++i) {
        const posIndex = i * 3;

        points.push(
            new THREE.Vector3(
                positions.array[posIndex],
                positions.array[posIndex + 1],
                positions.array[posIndex + 2])
        );
    }

    return points;
}

function Voxelization(obj: THREE.Mesh) {
    const box = new THREE.Box3().setFromObject(obj);
    const min = box.min;
    const max = box.max;

    const interiorPoints = [];

    for (let i = 0; i <= VOXEL_RESOLUTION; i++) {
        for (let j = 0; j <= VOXEL_RESOLUTION; j++) {
            for (let k = 0; k <= VOXEL_RESOLUTION; k++) {
                const point = new THREE.Vector3(
                    min.x + (i / VOXEL_RESOLUTION) * (max.x - min.x),
                    min.y + (j / VOXEL_RESOLUTION) * (max.y - min.y),
                    min.z + (k / VOXEL_RESOLUTION) * (max.z - min.z)
                );

                if (isPointInsideMesh(point, obj)) {
                    interiorPoints.push(point);
                }
            }
        }
    }

    return interiorPoints;
}

function getPointSet(obj: THREE.Mesh) {
    return {
        surfacePoints: getSurfacePoints(obj),
        interiorPoints: Voxelization(obj),
    }
}

/*
    Init - get a number of random points as center of spheres, set r = 0
*/

function initSpheres(
    points: THREE.Vector3[],
    numSpheres: number
) {
    const spheres: Sphere[] = [];

    const shuffledPoints = shuffleArray<THREE.Vector3>([...points]);

    for (let i = 0; i < Math.min(numSpheres, shuffledPoints.length); i++) {
        spheres.push({
            center: shuffledPoints[i].clone(),
            radius: 0
        });
    }

    while (spheres.length < numSpheres) {
        spheres.push({
            center: points[Math.floor(Math.random() * points.length)].clone(),
            radius: 0
        });
    }

    return spheres;
}

/*
    Point clustering (flood fill)
*/

type Cluster = {
    points: THREE.Vector3[],
    sphere: Sphere
}

function initClusters(
    spheres: Sphere[]
): Cluster[] {
    return spheres.map((sphere, i) => ({
        sphere: sphere,
        points: [],
    }));
}

// discrete method
function getOutsideVolume(
    sphere: Sphere,
    mesh: THREE.Mesh
) {
    const RESOLUTION = 10;
    const { center, radius } = sphere;

    const bounds = {
        min: new THREE.Vector3(center.x - radius, center.y - radius, center.z - radius),
        max: new THREE.Vector3(center.x + radius, center.y + radius, center.z + radius)
    }

    const stepX = (bounds.max.x - bounds.min.x) / RESOLUTION;
    const stepY = (bounds.max.y - bounds.min.y) / RESOLUTION;
    const stepZ = (bounds.max.z - bounds.min.z) / RESOLUTION;
    const volume = stepX * stepY * stepZ;
    let insideCount = 0;

    for (let i = 0; i <= RESOLUTION; i++) {
        for (let j = 0; j <= RESOLUTION; j++) {
            for (let k = 0; k <= RESOLUTION; k++) {
                const point = new THREE.Vector3(
                    bounds.min.x + i * stepX,
                    bounds.min.y + j * stepY,
                    bounds.min.z + k * stepZ
                );

                if (isPointInsideMesh(point, mesh)) {
                    insideCount++;
                }
            }
        }
    }

    return insideCount * volume;
}

function findNearestPoint(
    points: THREE.Vector3[],
    cluster: Cluster
) {
    let closestPointId: number = 0;
    let minDist = Infinity;

    for (let i = 0; i < points.length; i++) {
        const dist = cluster.sphere.center.distanceTo(points[i]);
        if (minDist > dist) {
            minDist = dist;
            closestPointId = i;
        }
    }

    return { point: points[closestPointId], minDist };
}

function expandSphere(
    sphere: Sphere,
    point: THREE.Vector3
) {
    let newSphere = { ...sphere };
    const distance = sphere.center.distanceTo(point);
    if (distance > sphere.radius) {
        sphere.radius = distance;
    }

    return newSphere;
}

function pointClustering(
    points: THREE.Vector3[],
    spheres: Sphere[],
    mesh: THREE.Mesh
) {
    const clusters = initClusters(spheres);

    const assigned = new Map<THREE.Vector3, number>();
    const queue: THREE.Vector3[] = [];

    // add nearest points to queue
    for (let i = 0; i < clusters.length; i++) {
        const nearestPoint = findNearestPoint(points, clusters[i]);
        if (nearestPoint && !assigned.has(nearestPoint.point)) {
            assigned.set(nearestPoint.point, i);
            queue.push(nearestPoint.point);
        }
    }

    while (queue.length > 0) {
        const currentPoint = queue.shift() as THREE.Vector3;

        const clusterId = assigned.get(currentPoint)!;
        const cluster = clusters[clusterId];

        cluster.points.push(currentPoint);
        cluster.sphere = expandSphere(cluster.sphere, currentPoint);

        const neighbors = getNeighbors(points, currentPoint, 10);

        for (const neighbor of neighbors) {
            if (assigned.has(neighbor)) continue;

            let bestCluster = clusterId;
            const newSphere = expandSphere(cluster.sphere, currentPoint);
            let minIncrease = getOutsideVolume(cluster.sphere, mesh) - getOutsideVolume(newSphere, mesh);
            for (let i = 0; i < clusters.length; i++) {
                if (i === clusterId) continue;
                const newSphere = expandSphere(clusters[i].sphere, currentPoint);
                const increase = getOutsideVolume(cluster.sphere, mesh) - getOutsideVolume(newSphere, mesh);
                if (increase < minIncrease) {
                    minIncrease = increase;
                    bestCluster = i;
                }
            }

            assigned.set(neighbor, bestCluster);
            queue.push(neighbor);
        }
    }

    return clusters;
}

function optimizeSphere(
    cluster: Cluster,
    mesh: THREE.Mesh
): Sphere {
    const points = cluster.points;
    let bestSphere = { ...cluster.sphere };
    let bestVolume = getOutsideVolume(bestSphere, mesh);

    const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 1, 0).normalize(),
        new THREE.Vector3(1, 0, 1).normalize(),
        new THREE.Vector3(0, 1, 1).normalize(),
        new THREE.Vector3(1, 1, 1).normalize()
    ];

    const stepSize = 0.1;
    const tolerance = 1e-4;

    for (let iter = 0; iter < 10; iter++) {
        let improved = false;

        for (const dir of directions) {
            let step = stepSize / Math.pow(2, iter);
            let bestDirVolume = bestVolume;
            let bestOffset = 0;

            for (let delta of [-step, step]) {
                const testCenter = bestSphere.center.clone().add(dir.clone().multiplyScalar(delta));
                const testSphere: Sphere = {
                    center: testCenter,
                    radius: computeBoundingRadius(testCenter, points)
                };

                const testVolume = getOutsideVolume(testSphere, mesh);

                if (testVolume < bestDirVolume) {
                    bestDirVolume = testVolume;
                    bestOffset = delta;
                }
            }

            if (bestOffset !== 0) {
                bestSphere.center.add(dir.clone().multiplyScalar(bestOffset));
                bestSphere.radius = computeBoundingRadius(bestSphere.center, points);
                bestVolume = bestDirVolume;
                improved = true;
            }
        }

        if (!improved && iter > 0) break;
        if (bestVolume < tolerance) break;
    }

    return bestSphere;
}

function updateClusterSpheres(
    points: THREE.Vector3[],
    clusters: Cluster[],
    mesh: THREE.Mesh
) {
    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        if (cluster.points.length === 0) continue;

        const optimizedSphere = optimizeSphere(cluster, mesh);

        const currentVolume = getOutsideVolume(cluster.sphere, mesh);
        const optimizedVolume = getOutsideVolume(optimizedSphere, mesh);

        if (optimizedVolume < currentVolume) {
            cluster.sphere = optimizedSphere;
        }
    }
}

function clusterTeleportation(
    points: THREE.Vector3[],
    clusters: Cluster[],
    mesh: THREE.Mesh
) {
}
