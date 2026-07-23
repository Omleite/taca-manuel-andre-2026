#!/usr/bin/env python3
"""
Add data validation dropdowns to Excel spreadsheet
Taca Manuel Andre 2026
"""

import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation
import json
import sys

def add_validation_to_excel():
    """Add dropdown validation to Result and Score columns"""
    
    # Load Excel file
    excel_path = r'c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.xlsx'
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    
    # Find last row with data
    last_row = ws.max_row
    print(f"Total rows: {last_row}")
    
    # Create validation for RESULTADO (Column F)
    dv_result = DataValidation(
        type="list",
        formula1='"Vence A,Vence B,A/S"',
        allow_blank=True,
        showInputMessage=True,
        showErrorMessage=True,
        errorTitle="Valor Invalido",
        error="Selecione: Vence A, Vence B ou A/S"
    )
    dv_result.error_style = 'stop'
    
    # Create validation for SCORE (Column G)
    dv_score = DataValidation(
        type="list",
        formula1='"1&0,1&1,1&2,1&3,2&0,2&1,2&2,2&3,3&0,3&1,3&2,3&3"',
        allow_blank=True,
        showInputMessage=True,
        showErrorMessage=True,
        errorTitle="Formato Invalido",
        error="Use X&Y (exemplo: 2&1)"
    )
    dv_score.error_style = 'stop'
    
    # Add validation to worksheet
    ws.add_data_validation(dv_result)
    ws.add_data_validation(dv_score)
    
    # Apply to ranges
    for row in range(2, last_row + 1):
        dv_result.add(f'F{row}')
        dv_score.add(f'G{row}')
    
    # Save
    wb.save(excel_path)
    print(f"✓ Validation added successfully")
    print(f"✓ File saved: {excel_path}")
    print(f"✓ Validations:")
    print(f"  - Resultado (Column F): Vence A | Vence B | A/S")
    print(f"  - Score (Column G): 1&0 | 1&1 | ... | 3&3")

if __name__ == '__main__':
    try:
        add_validation_to_excel()
    except ImportError:
        print("ERROR: openpyxl not installed")
        print("Install with: pip install openpyxl")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
