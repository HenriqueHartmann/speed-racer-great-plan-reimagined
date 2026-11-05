/**
 * Undo the exporter's Y-up conversion, once, for every model we load.
 *
 * The decoded worlds are Director's own data and Director is Z-up, like our
 * scene. glTF requires Y-up, so the exporter puts a -90 degree X rotation on a
 * node named `SceneRoot` and hangs everything beneath it. That conversion is
 * exactly what we do not want.
 *
 * Clear it rather than cancelling it with a second rotation: the data already
 * speaks our coordinate system, and two opposing quarter turns are a thing to
 * get wrong again later. The rotation is on the node *named* `SceneRoot`,
 * which is a child of the group the loader hands back - clearing the wrapper
 * does nothing, which is how this was got wrong once already.
 *
 * Two orientation bugs in this project came from reasoning about conventions
 * instead of reading the file, so the result is reported rather than assumed.
 */
import type * as THREE from 'three';

/** True when the conversion node was found and cleared. */
export function clearYUpConversion(scene: THREE.Object3D): boolean {
  const converted = scene.getObjectByName('SceneRoot') ?? scene;
  converted.quaternion.identity();
  converted.rotation.set(0, 0, 0);
  converted.updateMatrix();
  return converted.name === 'SceneRoot';
}
