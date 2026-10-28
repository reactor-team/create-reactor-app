"use client";

import { useEffect, useState } from "react";
import { useXmaxX21, useXmaxX21StateUpdate } from "@reactor-models/xmax-x2-1";
import { Panel } from "./ui";

// The model echoes the newest frame as [x, y] pairs, not request objects.
export function PointerPanel() {
  const { status } = useXmaxX21();
  const [points, setPoints] = useState<number[][]>([]);
  useXmaxX21StateUpdate((message) => setPoints(message.pointers));
  useEffect(() => {
    if (status === "disconnected") setPoints([]);
  }, [status]);

  return (
    <Panel label="Drag points">
      <p className="text-xs text-zinc-400">
        {points.length} active {points.length === 1 ? "point" : "points"}
      </p>
      {points.length > 0 && (
        <ol className="mt-2 space-y-1 font-mono text-xs text-zinc-300">
          {points.map(([x, y], index) => (
            <li key={index}>
              {index + 1}: {x.toFixed(3)}, {y.toFixed(3)}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Drag the output with up to eight fingers or one mouse pointer. Each
        source frame sends the latest four positions. Release every point to end
        the drag.
      </p>
    </Panel>
  );
}
