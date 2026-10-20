import { Mesh, Scene, Vector3 } from "three";

// Only the playable enclosure and props are solid. Sky, distant scenery and
// transparent water stay visual; copying world-space vertices keeps the import
// independent of the scene's nested groups and shared geometry.
export function courtyardTriangles(scene: Scene) {
  scene.updateMatrixWorld(true);
  const vertices: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();
  for (const name of ["CourtyardWalls", "Corners", "CourtCentre"]) {
    scene.getObjectByName(name)?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      if (materials.every((material) => material.transparent)) return;
      const positions = object.geometry.getAttribute("position");
      if (!positions) return;
      const offset = vertices.length / 3;
      for (let i = 0; i < positions.count; i++) {
        point
          .fromBufferAttribute(positions, i)
          .applyMatrix4(object.matrixWorld);
        vertices.push(point.x, point.y, point.z);
      }
      const index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? positions.count); i++)
        indices.push(offset + (index ? index.getX(i) : i));
    });
  }
  return [new Float32Array(vertices), new Uint32Array(indices)] as const;
}
