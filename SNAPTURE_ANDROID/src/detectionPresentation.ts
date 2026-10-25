import type {SceneItem} from './api';

/** Display wording is not an edited object label or a material confirmation. */
export function sceneItemTitle(item:SceneItem, correction?:string) {
  return correction || item.identification?.user_object_name || item.display_name || item.name;
}
