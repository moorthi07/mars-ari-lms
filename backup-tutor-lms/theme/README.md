# Mars Ed Custom Theme

Based on Open edX "Indigo" theme — the most modern, clean theme available.

## What's customized

- Platform name: "Mars Ed — MarsGeo Robotics University"
- Color palette: Dark navy + electric blue (matches MarsGeo dashboard)
- Logo: Mars Ed wordmark
- Homepage: Hero section with 3 course cards
- Certificate template: Mars Ed branded

## Apply theme

```bash
# Install Indigo (best modern Open edX theme)
tutor local do settheme indigo

# Then apply our CSS overrides
tutor local do importdemocourse  # optional demo content
```

## Color Variables (override in custom CSS)

```css
:root {
  --primary: #1976D2;        /* Electric blue — matches MarsGeo */
  --primary-dark: #0D47A1;
  --accent: #76B900;         /* NVIDIA green — for AI/GPU modules */
  --bg-dark: #1e1e1e;        /* Dashboard dark bg */
  --text-primary: #ffffff;
  --text-secondary: #aaaaaa;
}
```
