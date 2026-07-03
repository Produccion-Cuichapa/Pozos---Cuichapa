window.AdminExport = {
  csv(filename, rows){
    const u = AdminUtils;
    const flatRows = rows.map(row => u.flatten(row));
    const headers = Array.from(new Set(flatRows.flatMap(row => Object.keys(row))));

    const csv = [
      headers.join(','),
      ...flatRows.map(row => headers.map(h => this.cell(row[h])).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  cell(value){
    const s = String(value ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  }
};
