const puppeteer = require('puppeteer');
const fs = require('fs');

async function analyzeAsimovDesign() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Navigating to https://read.asimov.com/...');
  await page.goto('https://read.asimov.com/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait for content to render
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Taking screenshot...');
  await page.screenshot({
    path: '/Users/shivsid/curius-app/asimov-screenshot.png',
    fullPage: true
  });

  console.log('Extracting design data...');
  const designData = await page.evaluate(() => {
    const data = {
      colors: {
        backgrounds: new Set(),
        textColors: new Set(),
        borderColors: new Set(),
        accentColors: new Set()
      },
      typography: {
        fontFamilies: new Set(),
        fontSizes: new Set(),
        fontWeights: new Set(),
        lineHeights: new Set()
      },
      spacing: {
        paddings: new Set(),
        margins: new Set(),
        gaps: new Set()
      },
      cssVariables: {},
      cards: [],
      layout: {
        gridTemplateColumns: new Set(),
        gridGaps: new Set(),
        containerWidths: new Set()
      },
      effects: {
        boxShadows: new Set(),
        borderRadius: new Set(),
        transitions: new Set()
      }
    };

    // Extract CSS variables from :root
    const root = document.querySelector(':root');
    if (root) {
      const rootStyles = getComputedStyle(root);
      for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (prop.startsWith('--')) {
          data.cssVariables[prop] = rootStyles.getPropertyValue(prop).trim();
        }
      }
    }

    // Analyze all elements
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const styles = getComputedStyle(el);

      // Colors
      const bgColor = styles.backgroundColor;
      const color = styles.color;
      const borderColor = styles.borderColor;

      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        data.colors.backgrounds.add(bgColor);
      }
      if (color && color !== 'rgba(0, 0, 0, 0)') {
        data.colors.textColors.add(color);
      }
      if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
        data.colors.borderColors.add(borderColor);
      }

      // Typography
      if (styles.fontFamily) data.typography.fontFamilies.add(styles.fontFamily);
      if (styles.fontSize) data.typography.fontSizes.add(styles.fontSize);
      if (styles.fontWeight) data.typography.fontWeights.add(styles.fontWeight);
      if (styles.lineHeight) data.typography.lineHeights.add(styles.lineHeight);

      // Spacing
      if (styles.padding && styles.padding !== '0px') data.spacing.paddings.add(styles.padding);
      if (styles.margin && styles.margin !== '0px') data.spacing.margins.add(styles.margin);
      if (styles.gap && styles.gap !== 'normal') data.spacing.gaps.add(styles.gap);

      // Layout
      if (styles.gridTemplateColumns && styles.gridTemplateColumns !== 'none') {
        data.layout.gridTemplateColumns.add(styles.gridTemplateColumns);
      }
      if (styles.gap && styles.gap !== 'normal') {
        data.layout.gridGaps.add(styles.gap);
      }
      if (styles.width && !styles.width.includes('auto')) {
        data.layout.containerWidths.add(styles.width);
      }

      // Effects
      if (styles.boxShadow && styles.boxShadow !== 'none') {
        data.effects.boxShadows.add(styles.boxShadow);
      }
      if (styles.borderRadius && styles.borderRadius !== '0px') {
        data.effects.borderRadius.add(styles.borderRadius);
      }
      if (styles.transition && styles.transition !== 'all 0s ease 0s') {
        data.effects.transitions.add(styles.transition);
      }
    });

    // Specifically analyze card-like elements
    const cardSelectors = [
      'article', 'div[class*="card"]', 'div[class*="item"]',
      'a[class*="card"]', 'div[class*="post"]', 'div[class*="content"]'
    ];

    cardSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(card => {
        const styles = getComputedStyle(card);
        const cardData = {
          selector: selector,
          className: card.className,
          styles: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            padding: styles.padding,
            margin: styles.margin,
            borderRadius: styles.borderRadius,
            border: styles.border,
            boxShadow: styles.boxShadow,
            display: styles.display,
            width: styles.width,
            transition: styles.transition
          }
        };
        data.cards.push(cardData);
      });
    });

    // Get main container info
    const main = document.querySelector('main');
    if (main) {
      const mainStyles = getComputedStyle(main);
      data.layout.mainContainer = {
        maxWidth: mainStyles.maxWidth,
        padding: mainStyles.padding,
        margin: mainStyles.margin,
        backgroundColor: mainStyles.backgroundColor
      };
    }

    // Convert Sets to Arrays for JSON serialization
    Object.keys(data.colors).forEach(key => {
      data.colors[key] = Array.from(data.colors[key]);
    });
    Object.keys(data.typography).forEach(key => {
      data.typography[key] = Array.from(data.typography[key]);
    });
    Object.keys(data.spacing).forEach(key => {
      data.spacing[key] = Array.from(data.spacing[key]);
    });
    Object.keys(data.layout).forEach(key => {
      if (data.layout[key] instanceof Set) {
        data.layout[key] = Array.from(data.layout[key]);
      }
    });
    Object.keys(data.effects).forEach(key => {
      data.effects[key] = Array.from(data.effects[key]);
    });

    return data;
  });

  // Extract HTML structure for additional context
  const bodyHTML = await page.evaluate(() => {
    return document.body.innerHTML.substring(0, 50000); // First 50k chars
  });

  console.log('Saving analysis data...');
  fs.writeFileSync(
    '/Users/shivsid/curius-app/asimov-design-data.json',
    JSON.stringify(designData, null, 2)
  );

  fs.writeFileSync(
    '/Users/shivsid/curius-app/asimov-html-sample.html',
    bodyHTML
  );

  await browser.close();
  console.log('Analysis complete!');
}

analyzeAsimovDesign().catch(console.error);
