// List of essential header fields to show in the main table
const essentialHeaders = [
  'common_name',
  'color_name',
  'hex_code',
  'type',
  'in_use',
  'origin',
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

// Theme options
const themeOptions = [
  { name: 'light', icon: '☀️' },
  { name: 'dark', icon: '🌙' }
];

// Global variables
let sortDir = {};
let colorantsData = []; // Store the data globally for use in modal
let footnotes = []; // Store extracted footnotes
let currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
console.log(currentTheme);

// Utility functions
const utils = {
  // Create an element with attributes and optional text content
  createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    if (textContent) element.textContent = textContent;
    return element;
  },
  
  // Format text for display
  formatCitationLinks(text) {
    if (!text || typeof text !== 'string') return text || '';
    
    // Replace markdown-style links with HTML links and collect footnotes
    return text.replace(/\[oai_citation_attribution:([^‡]+)‡([^\]]+)\]\(([^)]+)\)/g, 
      (match, number, source, url) => {
        // Add to citations array if not already present
        const citationExists = footnotes.some(f => 
          f.number === number && f.source === source && f.url === url
        );
        
        if (!citationExists) {
          footnotes.push({ number, source, url });
        }
        
        // Return the formatted citation link with tooltip
        return `<a href="${url}" target="_blank" class="citation-link" title="Source: ${source}">[${number}]<span class="citation-tooltip">Source: ${source}<br>Click to visit</span></a>`;
      });
  },
  
  // Format chemical formulas with HTML subscripts
  formatChemicalFormula(text) {
    if (!text || typeof text !== 'string') return text || '';
    
    return text
      .replace(/([A-Za-z])(\d+)/g, '$1<sub>$2</sub>') // Simple subscripts like H2O
      .replace(/\(([^)]+)\)(\d+)/g, '($1)<sub>$2</sub>') // Parenthesized groups with subscripts
      .replace(/\·/g, '·') // Preserve dot operator
      .replace(/\[([^\]]+)\](\d+)/g, '[$1]<sub>$2</sub>'); // Bracketed groups with subscripts
  },
  
  // Process text with both chemical formulas and links
  processText(text) {
    if (!text || typeof text !== 'string') return text || '';
    
    // First handle links to avoid breaking them when processing chemical formulas
    let processed = this.formatCitationLinks(text);
    
    // Split by HTML tags and process only text portions
    const parts = processed.split(/(<[^>]*>)/);
    for (let i = 0; i < parts.length; i++) {
      // Only process parts that are not HTML tags
      if (i % 2 === 0) {
        parts[i] = this.formatChemicalFormula(parts[i]);
      }
    }
    
    return parts.join('');
  },
  
  // Extract primary content (before parentheses)
  getPrimaryContent(text) {
    if (!text || typeof text !== 'string') return text || '';
    const match = text.match(/^([^(]+)/);
    return match ? match[1].trim() : text.trim();
  }
};

// Theme management
const themeManager = {
  toggle() {
    this.set(currentTheme === 'light' ? 'dark' : 'light');
  },
  
  set(theme) {
    console.log('Setting theme to:', theme);
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    
    document.getElementById('themeToggle').textContent = theme === 'light' ? '☀️' : '🌙';

    currentTheme = theme;
  },
  
  init() {
    this.set(currentTheme);
  }
};

// Table management functions
const tableManager = {
  buildHeaders() {
    const headerRow = document.getElementById('tableHeaderRow');
    headerRow.innerHTML = ''; // Clear existing headers
  
    essentialHeaders.forEach((header, index) => {
      headerRow.appendChild(this.createHeader(header, index));
    });
  },
  
  createHeader(header, index) {
    const text = header.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    const attributes = { 'data-col-index': index, 'data-field': header };
    const th = utils.createElement('th', attributes, text);
    
    const sortIndicator = utils.createElement('span', { 
      class: 'sort-indicator', 
      'aria-hidden': 'true' 
    });
    
    th.appendChild(sortIndicator);
  
    sortDir[index] = 1;
    th.addEventListener('click', () => this.sortTable(index));
    return th;
  },
  
  sortTable(colIndex) {
    const table = document.getElementById('colorantsTable');
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.getElementsByTagName('tr'));
    
    // Get header to update sort indicators
    const header = document.querySelector(`th[data-col-index="${colIndex}"]`);
    
    // Reset all headers
    document.querySelectorAll('th').forEach(th => {
      th.classList.remove('sort-ascending', 'sort-descending');
      th.removeAttribute('aria-sort');
    });
    
    rows.sort(function (a, b) {
      const aText = a.cells[colIndex].innerText.toLowerCase();
      const bText = b.cells[colIndex].innerText.toLowerCase();
      
      // Try numeric comparison first
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return (aNum - bNum) * sortDir[colIndex];
      }
      
      // Then string comparison
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
      header.setAttribute('title', 'Sorted descending');
    } else {
      header.setAttribute('aria-sort', 'ascending');
      header.setAttribute('title', 'Sorted ascending');
    }
  },
  
  populateTable(data) {
    const tbody = document.querySelector('#colorantsTable tbody');
    tbody.innerHTML = '';
    
    if (!Array.isArray(data)) {
      console.error('Data is not an array:', data);
      return;
    }
    
    // Store data globally for modal use
    colorantsData = data;
    
    data.forEach((item, rowIndex) => {
      const tr = utils.createElement('tr', { 'data-index': rowIndex });
      tr.addEventListener('click', () => modalManager.open(rowIndex));
  
      essentialHeaders.forEach(header => {
        const td = utils.createElement('td');
        const contentDiv = utils.createElement('div', { class: 'cell-content' });
        let cellValue = item[header] || '';
  
        if (Array.isArray(cellValue)) {
          cellValue = cellValue.join(', ');
        }
  
        if (header === 'hex_code') {
          const swatch = utils.createElement('span', { 
            class: 'swatch', 
            style: `background-color: ${cellValue}` 
          });
          
          const swatchLarge = utils.createElement('span', { 
            class: 'swatch-large', 
            style: `background-color: ${cellValue}` 
          });
          
          contentDiv.appendChild(swatch);
          contentDiv.appendChild(swatchLarge);
          contentDiv.appendChild(document.createTextNode(cellValue));
        } else {
          contentDiv.innerHTML = utils.processText(cellValue);
        }
  
        td.appendChild(contentDiv);
        tr.appendChild(td);
      });
  
      tbody.appendChild(tr);
    });
  }
};

// Data loading and processing
const dataManager = {
  loadJSON() {
    const tableContainer = document.querySelector('.table-container');
    const loadingMsg = utils.createElement('div', { class: 'loading-message' }, 'Loading colorants data...');
    tableContainer.appendChild(loadingMsg);
  
    fetch('pigments.json')
      .then(response => {
        if (!response.ok) throw new Error(`Network response error: ${response.status} ${response.statusText}`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid or empty JSON data');
        loadingMsg.remove();
        this.generateSummary(data);
        this.generateFilters(data);
        tableManager.populateTable(data);
      })
      .catch(error => {
        console.error('Error loading or processing JSON data:', error);
        loadingMsg.textContent = `Error: ${error.message}`;
        loadingMsg.classList.add('error-message');
      });
  },
  
  generateSummary(data) {
    if (!data || !Array.isArray(data) || data.length === 0) return;
    
    const summaryStats = document.getElementById('summaryStats');
    summaryStats.innerHTML = '';
    
    // Calculate stats
    const totalColors = data.length;
    
    // Count by type
    const typeCount = data.reduce((acc, item) => {
      const type = item['type'] || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Count currently in use
    const inUseCount = data.reduce((acc, item) => {
      const useStatus = item['in_use'] || '';
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
  },
  
  generateFilters(data) {
    if (!data || !Array.isArray(data) || data.length === 0) return;
    
    const filterContainer = document.getElementById('filtersContainer');
    filterContainer.innerHTML = '';
    
    // Define which fields to create filters for
    const filterFields = ['type', 'in_use', 'origin'];
    
    // Create a filter for each field
    filterFields.forEach(field => {
      // Extract unique values for this field
      const uniqueValues = new Set();
      data.forEach(item => {
        let value = item[field];
        
        if (Array.isArray(value)) {
          value.forEach(v => {
            uniqueValues.add(utils.getPrimaryContent(v));
          });
        } else if (value) {
          uniqueValues.add(utils.getPrimaryContent(value));
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
      select.onchange = filterManager.applyFilters;
      
      // Add default option
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
};

// Filter management
const filterManager = {
  resetFilters() {
    // Clear the search input
    document.getElementById('searchInput').value = '';
    
    // Reset all filter dropdowns
    document.querySelectorAll('.filter-select').forEach(select => {
      select.selectedIndex = 0;
    });
    
    // Apply the reset (show all rows)
    this.applyFilters();
  },
  
  applyFilters() {
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
      let matchesSearch = !searchText;
      
      if (searchText) {
        // Search through all fields, not just visible ones
        matchesSearch = Object.values(item).some(value => {
          if (Array.isArray(value)) {
            return value.some(v => String(v).toLowerCase().includes(searchText));
          }
          return String(value).toLowerCase().includes(searchText);
        });
      }
      
      // Apply dropdown filters
      let matchesFilters = true;
      
      activeFilters.forEach(filter => {
        let value = item[filter.field];
        
        if (Array.isArray(value)) {
          // Check if any array item's primary content matches
          matchesFilters = matchesFilters && value.some(v => 
            utils.getPrimaryContent(String(v)).toLowerCase().includes(filter.value.toLowerCase())
          );
        } else {
          // Check if the string's primary content matches
          const primaryContent = utils.getPrimaryContent(String(value)).toLowerCase();
          matchesFilters = matchesFilters && primaryContent.includes(filter.value.toLowerCase());
        }
      });
      
      // Show/hide row based on all filters
      row.style.display = (matchesSearch && matchesFilters) ? '' : 'none';
    }
  }
};

// Modal management
const modalManager = {
  open(rowIndex) {
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
            li.innerHTML = utils.processText(item);
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
          valueElem.innerHTML = utils.processText(value);
        }
        
        detailItem.appendChild(label);
        detailItem.appendChild(valueElem);
        section.appendChild(detailItem);
      });
      
      modalDetails.appendChild(section);
    });
    
    // Populate footnotes
    this.populateFootnotes();
    
    // Show the modal
    document.getElementById('colorantModal').classList.add('active');
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
  },
  
  populateFootnotes() {
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
  },
  
  close() {
    document.getElementById('colorantModal').classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Initialize the application
function initApp() {
  themeManager.init();
  tableManager.buildHeaders();
  dataManager.loadJSON();
  
  // Set up event listeners
  document.getElementById('themeToggle').addEventListener('click', () => themeManager.toggle());
  document.getElementById('resetFilters').addEventListener('click', () => filterManager.resetFilters());
  document.getElementById('searchInput').addEventListener('input', () => filterManager.applyFilters());
  document.getElementById('colorantModal').addEventListener('click', function(event) {
    if (event.target === this) {
      modalManager.close();
    }
  });
  
  // Close modal on escape key
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && document.getElementById('colorantModal').classList.contains('active')) {
      modalManager.close();
    }
  });
}

// Initialize functions
window.onload = initApp;
