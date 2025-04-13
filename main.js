// List of essential header fields to show in the main table
const essentialHeaders = [
  'common_name',
  'color_name',
  'hex_code',
  'type',
  'in_use',
  'toxicity'
];

// All available fields (for the modal)
const allHeaders = [
  'common_name',
  'alt_names',
  'color_name',
  'source',
  'chemical_name',
  'formula',
  'type',
  'in_use',
  'not_used_reason',
  'natural_sources',
  'synthesis',
  'origin',
  'designations',
  'color_description',
  'hex_code',
  'toxicity',
  'history',
];

// Global variables
var sortDir = {};
var colorantsData = []; // Store the data globally for use in modal
var footnotes = []; // Store extracted footnotes

// Function to toggle dark/light theme
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Initialize theme from localStorage if available
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Use dark theme if user prefers dark mode
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

// Function to build the table headers (simplified)
function buildHeaders() {
  const headerRow = document.getElementById('tableHeaderRow');
  headerRow.innerHTML = ''; // Clear any existing headers
  
  essentialHeaders.forEach((header, index) => {
    const th = document.createElement('th');
    // Convert from snake_case to Title Case for display
    th.innerText = header.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    // Add sort indicator span
    const sortIndicator = document.createElement('span');
    sortIndicator.className = 'sort-indicator';
    th.appendChild(sortIndicator);
    
    th.dataset.colIndex = index;
    th.dataset.field = header;
    sortDir[index] = 1;
    th.addEventListener('click', function () {
      sortTable(index);
    });
    headerRow.appendChild(th);
  });
}

// Function to format citation links and extract footnotes
function formatCitationLinks(text) {
  // Ensure text is a string
  if (!text || typeof text !== 'string') return text || '';
  
  // Extract and format citations for footnotes
  const citations = [];
  
  // Replace markdown-style links with HTML links and collect footnotes
  // Pattern: [oai_citation_attribution:number‡source](url)
  const formattedText = text.replace(/\[oai_citation_attribution:([^‡]+)‡([^\]]+)\]\(([^)]+)\)/g, 
    function(match, number, source, url) {
      // Add to citations array if not already present
      const citationExists = footnotes.some(f => f.number === number && f.source === source && f.url === url);
      if (!citationExists) {
        footnotes.push({ number, source, url });
      }
      
      // Return the formatted citation link with tooltip
      return `<a href="${url}" target="_blank" class="citation-link" title="Source: ${source}">[${number}]<span class="citation-tooltip">Source: ${source}<br>Click to visit</span></a>`;
    });
  
  return formattedText;
}

// Function to handle chemical formulas with subscripts
function formatChemicalFormula(text) {
  // Ensure text is a string
  if (!text || typeof text !== 'string') return text || '';
  
  // Replace common chemical formula patterns with HTML subscripts
  return text
    .replace(/([A-Za-z])(\d+)/g, '$1<sub>$2</sub>') // Simple subscripts like H2O
    .replace(/\(([^)]+)\)(\d+)/g, '($1)<sub>$2</sub>') // Parenthesized groups with subscripts
    .replace(/\·/g, '·') // Preserve dot operator
    .replace(/\[([^\]]+)\](\d+)/g, '[$1]<sub>$2</sub>'); // Bracketed groups with subscripts
}

// Function to process text with both chemical formulas and links
function processText(text) {
  // Ensure text is a string
  if (!text || typeof text !== 'string') return text || '';
  
  // First handle links to avoid breaking them when processing chemical formulas
  let processed = formatCitationLinks(text);
  
  // Then handle chemical formulas, but skip processing inside HTML tags
  // Split by HTML tags and process only text portions
  const parts = processed.split(/(<[^>]*>)/);
  for (let i = 0; i < parts.length; i++) {
    // Only process parts that are not HTML tags
    if (i % 2 === 0) {
      parts[i] = formatChemicalFormula(parts[i]);
    }
  }
  
  return parts.join('');
}

// Function to extract the primary content from text (before parentheses)
function getPrimaryContent(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  // Get text before the first opening parenthesis if it exists
  const match = text.match(/^([^(]+)/);
  return match ? match[1].trim() : text.trim();
}

// Function to build table rows from JSON data (simplified version)
function populateTable(data) {
  const tbody = document.querySelector('#colorantsTable tbody');
  tbody.innerHTML = '';
  
  if (!Array.isArray(data)) {
    console.error('Data is not an array:', data);
    return;
  }
  
  // Store data globally for modal use
  colorantsData = data;
  
  data.forEach((item, rowIndex) => {
    if (!item || typeof item !== 'object') {
      console.warn('Invalid data item:', item);
      return;
    }
    
    const tr = document.createElement('tr');
    tr.dataset.index = rowIndex; // Store the row index for modal reference
    
    // Add click handler to open the modal
    tr.addEventListener('click', function() {
      openModal(rowIndex);
    });
    
    // Only add the essential columns
    essentialHeaders.forEach((header) => {
      const td = document.createElement('td');
      const contentDiv = document.createElement('div');
      contentDiv.className = 'cell-content';
      
      let cellValue = item[header] || '';
      
      // Convert arrays to comma-separated strings
      if (Array.isArray(cellValue)) {
        cellValue = cellValue.join(', ');
      }
      
      // For the "hex_code" column, add a swatch with larger hover preview
      if (header === 'hex_code') {
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = cellValue;
        
        const swatchLarge = document.createElement('span');
        swatchLarge.className = 'swatch-large';
        swatchLarge.style.backgroundColor = cellValue;
        
        contentDiv.appendChild(swatch);
        contentDiv.appendChild(swatchLarge);
        contentDiv.appendChild(document.createTextNode(cellValue));
      } else {
        // For all other fields, process for potential links and formulas
        contentDiv.innerHTML = processText(cellValue);
      }
      
      td.appendChild(contentDiv);
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
}

// Function to load JSON data
function loadJSON() {
  const tableContainer = document.querySelector('.table-container');
  
  // Create a loading indicator
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'loading-message';
  loadingMsg.textContent = 'Loading colorants data...';
  loadingMsg.style.textAlign = 'center';
  loadingMsg.style.padding = '2rem';
  loadingMsg.style.color = 'var(--text-color)';
  tableContainer.appendChild(loadingMsg);
  
  fetch('pigments.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Network response error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      // Validate data structure
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid JSON data: expected an array of colorant objects');
      }
      
      if (data.length === 0) {
        throw new Error('JSON data is empty');
      }
      
      // Remove loading message
      loadingMsg.remove();
      
      // Generate summary and filters
      generateSummary(data);
      generateFilters(data);
      
      // Populate the table
      populateTable(data);
    })
    .catch((error) => {
      console.error('Error loading or processing JSON data:', error);
      
      // Display error message in the table container
      loadingMsg.textContent = `Error: ${error.message}`;
      loadingMsg.style.color = '#e53935';
      loadingMsg.style.border = '1px solid #ffcdd2';
      loadingMsg.style.borderRadius = '4px';
      loadingMsg.style.backgroundColor = '#ffebee';
      loadingMsg.style.padding = '1rem';
    });
}

// Function to generate summary statistics
function generateSummary(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return;
  
  const summaryStats = document.getElementById('summaryStats');
  summaryStats.innerHTML = '';
  
  // Calculate stats
  const totalColors = data.length;
  
  // Count synthetic, natural, and both
  const typeCount = data.reduce((acc, item) => {
    const type = item['type'] || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  // Count currently in use (corrected)
  const inUseCount = data.reduce((acc, item) => {
    const useStatus = item['in_use'] || '';
    // Count any that are Yes or have Limited in their status
    if (useStatus === true || useStatus === 'Yes' || useStatus.includes('Limited')) {
      acc.inUse++;
    } else {
      acc.notInUse++;
    }
    return acc;
  }, { inUse: 0, notInUse: 0 });
  
  // Count unique countries
  const countries = new Set();
  data.forEach(item => {
    const countryList = item['origin'];
    if (Array.isArray(countryList)) {
      countryList.forEach(country => countries.add(country));
    } else if (typeof countryList === 'string' && countryList) {
      countryList.split(/,\s*/).forEach(country => countries.add(country));
    }
  });
  
  // Count historical periods
  const timePeriodsUsed = new Set();
  data.forEach(item => {
    const history = item['history'] || '';
    // Look for common time period indicators
    const periods = [
      'ancient', 'medieval', 'renaissance', 'century', 'BC', 'AD', 
      '1600s', '1700s', '1800s', '1900s', 'prehistoric'
    ];
    
    for (const period of periods) {
      if (history.toLowerCase().includes(period)) {
        timePeriodsUsed.add(period);
      }
    }
  });
  
  // Create stat elements
  const stats = [
    { label: 'Total Colorants', value: totalColors },
    { label: 'Natural Sources', value: typeCount['Natural'] || 0 },
    { label: 'Synthetic', value: typeCount['Synthetic'] || 0 },
    { label: 'Currently in Use', value: inUseCount.inUse },
    { label: 'Countries of Origin', value: countries.size },
    { label: 'Historical Periods', value: timePeriodsUsed.size }
  ];
  
  stats.forEach(stat => {
    const statItem = document.createElement('div');
    statItem.className = 'stat-item';
    
    const statValue = document.createElement('div');
    statValue.className = 'stat-value';
    statValue.textContent = stat.value;
    
    const statLabel = document.createElement('div');
    statLabel.className = 'stat-label';
    statLabel.textContent = stat.label;
    
    statItem.appendChild(statValue);
    statItem.appendChild(statLabel);
    summaryStats.appendChild(statItem);
  });
}

// Function to create filter dropdowns
function generateFilters(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return;
  
  const filterContainer = document.getElementById('filtersContainer');
  filterContainer.innerHTML = '';
  
  // Define which fields to create filters for
  const filterFields = [
    'type', 
    'in_use',
    'origin'
  ];
  
  // Create a filter for each field
  filterFields.forEach(field => {
    // Extract unique values for this field
    const uniqueValues = new Set();
    data.forEach(item => {
      let value = item[field];
      
      if (Array.isArray(value)) {
        value.forEach(v => {
          // For array items, use primary content
          uniqueValues.add(getPrimaryContent(v));
        });
      } else if (value) {
        // For string values, use primary content
        uniqueValues.add(getPrimaryContent(value));
      }
    });
    
    if (uniqueValues.size <= 1) return; // Skip if not enough values
    
    // Create filter group
    const filterGroup = document.createElement('div');
    filterGroup.className = 'filter-group';
    
    // Create select element
    const select = document.createElement('select');
    select.className = 'filter-select';
    select.dataset.field = field;
    select.onchange = applyFilters;
    
    // Add default option - fix in_use placeholder text
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = `Filter by ${field === 'in_use' ? 'usage status' : field.replace('_', ' ')}`;
    select.appendChild(defaultOption);
    
    // Add options for each unique value
    Array.from(uniqueValues).sort().forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    
    filterGroup.appendChild(select);
    filterContainer.appendChild(filterGroup);
  });
}

// Function to reset all filters and search
function resetFilters() {
  // Clear the search input
  document.getElementById('searchInput').value = '';
  
  // Reset all filter dropdowns
  document.querySelectorAll('.filter-select').forEach(select => {
    select.selectedIndex = 0;
  });
  
  // Apply the reset (show all rows)
  applyFilters();
}

// Function to apply all active filters
function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const searchText = searchInput.value.toLowerCase();
  
  const filterSelects = document.querySelectorAll('.filter-select');
  const activeFilters = Array.from(filterSelects)
    .filter(select => select.value !== '')
    .map(select => ({
      field: select.dataset.field,
      value: select.value
    }));
  
  const table = document.getElementById('colorantsTable');
  const rows = table.getElementsByTagName('tr');
  
  // Skip header row (i=0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Get the row's data index
    const dataIndex = parseInt(row.dataset.index);
    const item = colorantsData[dataIndex];
    
    // First check if item exists
    if (!item) continue;
    
    // Check if all text content matches the search
    let matchesSearch = false;
    if (searchText) {
      // Search through all fields, not just visible ones
      matchesSearch = Object.values(item).some(value => {
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(searchText));
        }
        return String(value).toLowerCase().includes(searchText);
      });
    } else {
      matchesSearch = true; // No search text means it matches
    }
    
    // Apply dropdown filters
    let matchesFilters = true;
    
    activeFilters.forEach(filter => {
      let value = item[filter.field];
      
      if (Array.isArray(value)) {
        // Check if any array item's primary content matches
        matchesFilters = matchesFilters && value.some(v => 
          getPrimaryContent(String(v)).toLowerCase().includes(filter.value.toLowerCase())
        );
      } else {
        // Check if the string's primary content matches
        const primaryContent = getPrimaryContent(String(value)).toLowerCase();
        matchesFilters = matchesFilters && primaryContent.includes(filter.value.toLowerCase());
      }
    });
    
    // Show/hide row based on all filters
    row.style.display = (matchesSearch && matchesFilters) ? '' : 'none';
  }
}

// Update the search filter function
function filterTable() {
  applyFilters();
}

// Sorting function
function sortTable(colIndex) {
  const table = document.getElementById('colorantsTable');
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.getElementsByTagName('tr'));
  
  // Get header to update sort indicators
  const header = document.querySelector(`th[data-col-index="${colIndex}"]`);
  
  // Reset all headers
  document.querySelectorAll('th').forEach(th => {
    if (th !== header) {
      th.style.background = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color');
      th.removeAttribute('aria-sort');
    }
  });
  
  rows.sort(function (a, b) {
    const aText = a.cells[colIndex].innerText.toLowerCase();
    const bText = b.cells[colIndex].innerText.toLowerCase();
    
    // Attempt to convert to numbers or dates if possible
    const aNum = parseFloat(aText);
    const bNum = parseFloat(bText);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return (aNum - bNum) * sortDir[colIndex];
    }
    
    if (aText < bText) return -1 * sortDir[colIndex];
    if (aText > bText) return 1 * sortDir[colIndex];
    return 0;
  });
  
  // Reattach sorted rows
  rows.forEach((row) => tbody.appendChild(row));
  sortDir[colIndex] *= -1;
  
  // Update sort indicator
  if (sortDir[colIndex] === -1) {
    header.setAttribute('aria-sort', 'descending');
    header.style.background = '#d1d7ee';
  } else {
    header.setAttribute('aria-sort', 'ascending');
    header.style.background = '#e8eaf6';
  }
}

// Modal functions
function openModal(rowIndex) {
  // Reset footnotes array for each new modal
  footnotes = [];
  
  const item = colorantsData[rowIndex];
  if (!item) return;
  
  // Set the modal title
  document.getElementById('modalTitle').textContent = item.common_name || 'Colorant Details';
  
  // Set the color swatch
  const modalSwatch = document.getElementById('modalColorSwatch');
  modalSwatch.style.backgroundColor = item.hex_code || '#FFFFFF';
  
  // Populate the modal details
  const modalDetails = document.getElementById('modalDetails');
  modalDetails.innerHTML = '';
  
  // Group the fields into logical sections
  const sections = {
    'Basic Information': ['common_name', 'alt_names', 'color_name', 'color_description', 'hex_code'],
    'Chemical Properties': ['chemical_name', 'formula', 'source'],
    'Production & Origin': ['type', 'natural_sources', 'synthesis', 'origin'],
    'Usage & Safety': ['in_use', 'not_used_reason', 'toxicity', 'designations'],
    'Historical Context': ['history']
  };
  
  // Create each section
  Object.entries(sections).forEach(([sectionTitle, fields]) => {
    // Check if any fields in this section have values
    const hasContent = fields.some(field => {
      const value = item[field];
      return value && (Array.isArray(value) ? value.length > 0 : true);
    });
    
    if (!hasContent) return; // Skip empty sections
    
    const section = document.createElement('div');
    section.className = 'detail-section';
    
    const sectionHeader = document.createElement('h3');
    sectionHeader.textContent = sectionTitle;
    section.appendChild(sectionHeader);
    
    // Add each field in the section
    fields.forEach(field => {
      let value = item[field];
      
      // Skip empty fields
      if (!value || (Array.isArray(value) && value.length === 0)) return;
      
      const detailItem = document.createElement('div');
      detailItem.className = 'detail-item';
      
      const label = document.createElement('div');
      label.className = 'detail-label';
      label.textContent = field.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const valueElem = document.createElement('div');
      valueElem.className = 'detail-value';
      
      // Special handling for arrays - turn them into unordered lists
      if (Array.isArray(value)) {
        const ul = document.createElement('ul');
        ul.className = 'detail-list';
        
        value.forEach(item => {
          const li = document.createElement('li');
          li.innerHTML = processText(item);
          ul.appendChild(li);
        });
        
        valueElem.appendChild(ul);
      }
      // Special handling for hex code with larger swatch
      else if (field === 'hex_code') {
        const swatch = document.createElement('span');
        swatch.className = 'modal-swatch';
        swatch.style.backgroundColor = value;
        valueElem.appendChild(swatch);
        valueElem.appendChild(document.createTextNode(value));
      } 
      // For all other fields, process for chemical formulas and links
      else {
        valueElem.innerHTML = processText(value);
      }
      
      detailItem.appendChild(label);
      detailItem.appendChild(valueElem);
      section.appendChild(detailItem);
    });
    
    modalDetails.appendChild(section);
  });
  
  // Populate footnotes
  populateFootnotes();
  
  // Show the modal
  document.getElementById('colorantModal').classList.add('active');
  
  // Prevent body scrolling
  document.body.style.overflow = 'hidden';
}

// Function to populate footnotes in the modal
function populateFootnotes() {
  const footnotesList = document.getElementById('footnotesList');
  footnotesList.innerHTML = '';
  
  const footnoteSection = document.querySelector('.modal-footnotes');
  
  if (footnotes.length === 0) {
    footnoteSection.style.display = 'none';
    return;
  }
  
  footnoteSection.style.display = 'block';
  
  // Sort footnotes by number
  footnotes.sort((a, b) => parseInt(a.number) - parseInt(b.number));
  
  // Remove duplicates
  const uniqueFootnotes = [];
  const seen = new Set();
  
  footnotes.forEach(footnote => {
    const key = `${footnote.number}-${footnote.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFootnotes.push(footnote);
    }
  });
  
  // Create footnote items
  uniqueFootnotes.forEach(footnote => {
    const li = document.createElement('li');
    li.className = 'footnote-item';
    
    const link = document.createElement('a');
    link.className = 'footnote-link';
    link.href = footnote.url;
    link.target = '_blank';
    link.textContent = `[${footnote.number}]`;
    
    li.appendChild(link);
    li.appendChild(document.createTextNode(` ${footnote.source}`));
    
    footnotesList.appendChild(li);
  });
}

function closeModal() {
  document.getElementById('colorantModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal on clicking outside the content
document.getElementById('colorantModal').addEventListener('click', function(event) {
  if (event.target === this) {
    closeModal();
  }
});

// Close modal on escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' && document.getElementById('colorantModal').classList.contains('active')) {
    closeModal();
  }
});

// Initialize functions
window.onload = function () {
  initTheme();
  buildHeaders();
  loadJSON();
  
  // Add event listener for theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  
  // Add event listener for reset button
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
};
