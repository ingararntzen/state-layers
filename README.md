# State Layers

**StateLayers** is a lightweight JavaScript framework and reference implementation of **State-driven Layering** [1]. While time-driven media is often equated with video and audio, StateLayers lets you build time-driven media experiences as native products of the Web platform, supporting a time-dependent narrative by carefully directing layout, content selections, render components, and styling.

Unlike traditional approaches, StateLayers does not produce finalized assets for playback. Instead, StateLayers fully embraces the Web model, orchestrating experiences in real time directly from online resources while remaining responsive to dynamic changes during playback. Moreover, StateLayers does not introduce restrictions on data formats or interfaces, enabling integration with custom data backends and rendering frameworks.

StateLayers treats timing, control and layering as live application state, and defines a programming model based on three concepts: Track, Cursor, and layering operations. Tracks provide a common interface for time-dependent resources (e.g., logs, subtitles, scripts), while Cursors represent resources with a current value (e.g., clocks, variables, event streams). Layering operations let you record tracks in real time, shift them on a timeline, merge them, and play them back synchronously under shared time control.

StateLayers is lightweight, extensible, and practical. By adding generic support for timing, control, and layering to data-driven platforms, StateLayers allows developers to prototype or deploy rich, flexible media experiences, with custom choices for backend services and rendering frameworks.

[1] *Ingar M. Arntzen, Njål T. Borch, and Anders Andersen. “State-driven Layering for Time-driven Media Production in Data-driven Platforms: A Foundation for Scalable, Personalized Media Production on Consumer Devices”. Submitted to Computing Conference 2026, London.*

