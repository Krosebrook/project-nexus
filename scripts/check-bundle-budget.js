#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BUDGET_KB = {
  'main': 300,
  'vendor': 500,
  'total': 800
};

const BASELINE_PATH = path.join(__dirname, '../.baseline-bundle-sizes.json');
const DIST_PATH = path.join(__dirname, '../frontend/dist');

function getFileSizes() {
  const sizes = {};
  
  if (!fs.existsSync(DIST_PATH)) {
    console.error('❌ Build directory not found. Run build first.');
    process.exit(1);
  }

  const files = fs.readdirSync(path.join(DIST_PATH, 'assets'), { recursive: true });
  
  let totalSize = 0;
  
  files.forEach(file => {
    if (file.endsWith('.js') && !file.endsWith('.map')) {
      const filePath = path.join(DIST_PATH, 'assets', file);
      const stat = fs.statSync(filePath);
      const sizeKB = Math.round(stat.size / 1024);
      
      sizes[file] = sizeKB;
      totalSize += sizeKB;
      
      console.log(`📦 ${file}: ${sizeKB} KB`);
    }
  });
  
  sizes['_total'] = totalSize;
  return sizes;
}

function checkBudget(sizes) {
  console.log('\n💰 Budget Check:');
  
  let failed = false;
  const total = sizes['_total'];
  
  if (total > BUDGET_KB.total) {
    console.error(`❌ Total bundle size (${total} KB) exceeds budget (${BUDGET_KB.total} KB)`);
    failed = true;
  } else {
    console.log(`✅ Total bundle size: ${total} KB (budget: ${BUDGET_KB.total} KB)`);
  }
  
  Object.entries(sizes).forEach(([file, size]) => {
    if (file === '_total') return;
    
    let budget;
    if (file.includes('vendor')) {
      budget = BUDGET_KB.vendor;
    } else {
      budget = BUDGET_KB.main;
    }
    
    if (size > budget) {
      console.warn(`⚠️  ${file} (${size} KB) may exceed budget (${budget} KB)`);
    }
  });
  
  return failed ? 1 : 0;
}

function compareWithBaseline(sizes) {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.log('\n📝 No baseline found. Creating baseline...');
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(sizes, null, 2));
    console.log('✅ Baseline saved');
    return 0;
  }
  
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
  
  console.log('\n📊 Comparison with baseline:');
  
  const currentTotal = sizes['_total'];
  const baselineTotal = baseline['_total'];
  const diff = currentTotal - baselineTotal;
  const diffPct = ((diff / baselineTotal) * 100).toFixed(1);
  
  if (diff > 0) {
    console.log(`📈 Total size increased by ${diff} KB (${diffPct}%)`);
  } else if (diff < 0) {
    console.log(`📉 Total size decreased by ${Math.abs(diff)} KB (${Math.abs(diffPct)}%)`);
  } else {
    console.log(`✅ No change in total size`);
  }
  
  const MAX_REGRESSION_PCT = 10;
  if (parseFloat(diffPct) > MAX_REGRESSION_PCT) {
    console.error(`❌ Bundle size regression exceeds ${MAX_REGRESSION_PCT}%`);
    return 1;
  }
  
  return 0;
}

const sizes = getFileSizes();
const budgetFailed = checkBudget(sizes);
const regressionFailed = compareWithBaseline(sizes);

process.exit(budgetFailed || regressionFailed);
