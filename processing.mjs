import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processReports() {
  // Get parameters from command line arguments
  const urlArg = process.argv.find(arg => arg.startsWith('--url='));
  const reportTypeArg = process.argv.find(arg => arg.startsWith('--report-type='));
  
  const websiteUrl = urlArg ? urlArg.split('=')[1] : process.env.WEBSITE_URL;
  const reportType = reportTypeArg ? reportTypeArg.split('=')[1] : 'all';
  
  if (!websiteUrl) {
    console.error('L Website URL is required. Use --url= parameter or WEBSITE_URL environment variable');
    process.exit(1);
  }
  
  console.log(`= Processing reports for: ${websiteUrl}`);
  console.log(`=� Report type: ${reportType}`);
  console.log(`� Processing started at: ${new Date().toISOString()}`);
  
  const datasetDir = path.join(__dirname, 'dataset');
  
  if (!fs.existsSync(datasetDir)) {
    console.error('L Dataset directory not found. No reports to process.');
    process.exit(1);
  }
  
  // Find all generated reports
  const files = fs.readdirSync(datasetDir);
  const reports = [];
  
  // Process different report types
  if (reportType === 'all' || reportType === 'lighthouse') {
    const lighthouseReports = files.filter(file => file.startsWith('lighthouse-report-'));
    const lighthouseSummaries = files.filter(file => file.startsWith('lighthouse-summary-'));
    const screenshots = files.filter(file => file.includes('screenshot-'));
    
    reports.push({
      type: 'lighthouse',
      reports: lighthouseReports.map(file => path.join(datasetDir, file)),
      summaries: lighthouseSummaries.map(file => path.join(datasetDir, file)),
      screenshots: screenshots.map(file => path.join(datasetDir, file))
    });
  }
  
  if (reportType === 'all' || reportType === 'cookies') {
    const cookieReports = files.filter(file => file.startsWith('cookies-'));
    
    if (cookieReports.length > 0) {
      reports.push({
        type: 'cookies',
        reports: cookieReports.map(file => path.join(datasetDir, file))
      });
    }
  }
  
  if (reportType === 'all' || reportType === 'accessibility') {
    const accessibilityReports = files.filter(file => file.startsWith('accessibility-report'));
    const accessibilitySummaries = files.filter(file => file.startsWith('accessibility-summary'));
    const accessibilityScreenshots = files.filter(file => file.startsWith('accessibility-screenshot'));
    
    if (accessibilityReports.length > 0 || accessibilitySummaries.length > 0) {
      reports.push({
        type: 'accessibility',
        reports: accessibilityReports.map(file => path.join(datasetDir, file)),
        summaries: accessibilitySummaries.map(file => path.join(datasetDir, file)),
        screenshots: accessibilityScreenshots.map(file => path.join(datasetDir, file))
      });
    }
  }
  
  if (reportType === 'all' || reportType === 'html-tree-metadata') {
    const htmlTreeReports = files.filter(file => file.startsWith('html-tree-metadata'));
    const htmlTreeSummaries = files.filter(file => file.startsWith('html-tree-summary'));
    const htmlTreeViewports = files.filter(file => file.match(/^html-tree-(phone|tablet|desktop)\.json$/));
    const htmlTreeScreenshots = files.filter(file => file.startsWith('html-tree-screenshot-'));
    
    if (htmlTreeReports.length > 0 || htmlTreeSummaries.length > 0) {
      reports.push({
        type: 'html-tree-metadata',
        reports: htmlTreeReports.map(file => path.join(datasetDir, file)),
        summaries: htmlTreeSummaries.map(file => path.join(datasetDir, file)),
        viewports: htmlTreeViewports.map(file => path.join(datasetDir, file)),
        screenshots: htmlTreeScreenshots.map(file => path.join(datasetDir, file))
      });
    }
  }
  
  // Create processing summary
  const processingSummary = {
    url: websiteUrl,
    reportType: reportType,
    timestamp: new Date().toISOString(),
    reports: reports,
    totalFiles: files.length,
    fileList: files
  };
  
  // Save processing summary
  const summaryPath = path.join(datasetDir, 'processing-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(processingSummary, null, 2));
  console.log(`=� Processing summary saved to: ${summaryPath}`);
  
  // Display results
  console.log('\n<� PROCESSING RESULTS');
  console.log('====================');
  console.log(`< URL: ${websiteUrl}`);
  console.log(`=� Report Type: ${reportType}`);
  console.log(`=� Total Files: ${files.length}`);
  
  reports.forEach(report => {
    console.log(`\n=� ${report.type.toUpperCase()} Reports:`);
    if (report.reports) {
      console.log(`  =� Report files: ${report.reports.length}`);
    }
    if (report.summaries) {
      console.log(`  =� Summary files: ${report.summaries.length}`);
    }
    if (report.screenshots) {
      console.log(`  =� Screenshots: ${report.screenshots.length}`);
    }
    if (report.viewports) {
      console.log(`  📱 Viewport files: ${report.viewports.length}`);
    }
  });
  
  console.log('\n=� All generated files:');
  files.forEach(file => {
    console.log(`  " ${file}`);
  });
  
  console.log('\n Report processing completed successfully!');
}

// Run the processing
processReports().catch(error => {
  console.error('L Report processing failed:', error.message);
  process.exit(1);
});