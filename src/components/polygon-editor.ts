import {
  defineComponent,
  inject,
  onUnmounted,
  PropType,
  Ref,
  toRaw,
  watch,
} from 'vue';
import useCleanUp from '../composables/use-clean-up';
import { builtStyle, buildGeometries } from './multi-polygon';

export default defineComponent({
  name: 'tmap-polygon-editor',
  props: {
    id: {
      type: String,
      default: 'default',
    },
    zIndex: {
      type: Number,
      default: 2,
    },
    snappable: {
      type: Boolean,
      default: true,
    },
    drawingStyleId: {
      type: String,
      default: 'drawing',
    },
    selectedStyleId: {
      type: String,
      default: 'selected',
    },
    styles: {
      type: Object as PropType<{ [key: string]: TMap.PolygonStyleOptions }>,
      required: true,
    },
    modelValue: {
      type: Array as PropType<TMap.PolygonGeometry[]>,
      required: true,
    },
    actionMode: {
      type: Number,
    },
  },
  emits: ['update:modelValue', 'select', 'error','draw_complete','adjust_complete','delete_complete','split_complete','union_complete'],
  setup(props, { emit }) {
    const map = inject<Ref<TMap.Map>>('map');
    if (!map) {
      return {};
    }
    const originMap = toRaw(map.value);
    useCleanUp(originMap, props.id);
    const geometries = buildGeometries(props.modelValue);
    const polygon = new TMap.MultiPolygon({
      id: props.id,
      map: originMap,
      zIndex: props.zIndex,
      styles: builtStyle(props.styles),
      geometries,
    });
    const editor = new TMap.tools.GeometryEditor<TMap.MultiPolygon>({
      map: originMap,
      overlayList: [
        {
          overlay: polygon,
          id: props.id,
          drawingStyleId: props.drawingStyleId,
          selectedStyleId: props.selectedStyleId,
        },
      ],
      actionMode:
        props.actionMode === 1
          ? TMap.tools.constants.EDITOR_ACTION.INTERACT
          : TMap.tools.constants.EDITOR_ACTION.DRAW,
      activeOverlayId: props.id, // 激活图层
      selectable: true, // 开启点选功能
      snappable: props.snappable, // 开启吸附
    });
    editor.on('select', () => {
      emit('select', editor.getSelectedList());
    });
    editor.on('draw_complete', (e: TMap.PolygonGeometry) => {
      emit('update:modelValue', [...props.modelValue, e]);
      emit('draw_complete', e);
    });
    editor.on('adjust_complete', (e: TMap.PolygonGeometry) => {
      for (let i = props.modelValue.length - 1; i >= 0; i -= 1) {
        if (props.modelValue[i].id === e.id) {
          Object.assign(props.modelValue[i], e);
          emit('update:modelValue', [...props.modelValue]);
          emit('adjust_complete', e);
          break;
        }
      }
    });
    editor.on('delete_complete', (e: TMap.PolygonGeometry[]) => {
      const removedIds = e.map((v) => v.id);
      emit(
        'update:modelValue',
        props.modelValue.filter((v) => removedIds.indexOf(v.id) === -1),
      );
      emit('select', editor.getSelectedList());
      emit('delete_complete', e);
    });
    editor.on('split_complete', (e: TMap.PolygonGeometry[]) => {
      const activeOverlay = editor.getActiveOverlay();
      emit('update:modelValue', [
        ...activeOverlay.overlay.getGeometries(),
        ...e,
      ]);
      emit('select', editor.getSelectedList());
      emit('split_complete', e);
    });
    editor.on('union_complete', (e: TMap.PolygonGeometry) => {
      const activeOverlay = editor.getActiveOverlay();
      emit('update:modelValue', [...activeOverlay.overlay.getGeometries(), e]);
      emit('select', editor.getSelectedList());
      emit('union_complete', e);
    });
    editor.on('split_fail', (e: object) => {
      emit('error', e);
    });
    editor.on('union_fail', (e: object) => {
      emit('error', e);
    });
    // 更新 overlay 几何数据的函数
    function updateOverlay() {
      const geometries = buildGeometries(props.modelValue);
      // // 更新 geometries
      polygon.setGeometries(geometries);

      // 确保 GeometryEditor 监听到变化
      // editor.setOverlay(polygon2);

      // 或者直接更新 editor.overlayList 中的数据
      // const targetOverlay = editor.overlayList.find(item => item.id === props.id);
      // if (targetOverlay) {
      //   targetOverlay.overlay.setGeometries(geometries);
      // }
    }
    watch(
      () => props.actionMode,
      (actionMode) => {
        const x: TMap.tools.constants.EDITOR_ACTION =
          actionMode === 1
            ? TMap.tools.constants.EDITOR_ACTION.INTERACT
            : TMap.tools.constants.EDITOR_ACTION.DRAW;
        editor.setActionMode(x);
      },
    );
    onUnmounted(() => {
      polygon.setMap(null);
      try {
        editor.destroy();
      } catch (e) {
        // 直接销毁地图时会报错，兼容一下
      }
    });
    return {
      select: editor.select.bind(editor),
      stop: editor.stop.bind(editor),
      split: editor.split.bind(editor),
      union: editor.union.bind(editor),
      delete: editor.delete.bind(editor),
      destroy: editor.destroy.bind(editor),
      getSelectedList: editor.getSelectedList.bind(editor),
      updateOverlay,
    };
  },
  render() {
    return null;
  },
});
