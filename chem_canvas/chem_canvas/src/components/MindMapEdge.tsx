import type { CSSProperties } from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath } from 'reactflow';

function MindMapEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, data } = props;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY: sourceY + 12,
    targetX,
    targetY,
    borderRadius: 16,
  });

  const isDependency = data?.kind === 'dependency';

  const style: CSSProperties = {
    stroke: isDependency ? '#fb923c' : '#cbd5f5',
    strokeWidth: isDependency ? 1.8 : 2,
    strokeDasharray: isDependency ? '6 6' : '8 10',
    opacity: 0.7,
    ...props.style,
  };

  return <BaseEdge path={edgePath} style={style} />;
}

export default MindMapEdge;