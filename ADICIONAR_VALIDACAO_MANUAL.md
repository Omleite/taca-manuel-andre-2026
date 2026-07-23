# GUIA: Adicionar Dropdowns ao Excel (Método Manual)

## ✓ Status Atual
- ✅ Ficheiro Excel criado: `Calendario_Resultados_IMPORT.xlsx`
- ✅ Estrutura com 72 matches
- ✅ Bordas em todas as células
- ✅ Primeira linha congelada
- ⚠️ Faltam: Dropdowns com validação

## 🎯 Objetivo
Adicionar dropdowns às colunas **F (Resultado)** e **G (Score)** para evitar erros de digitação.

---

## 📋 Método 1: Adicionar Validação Manual no Excel

### Para a Coluna F (Resultado) - Valores: "Vence A", "Vence B", "A/S"

1. **Selecionar o intervalo F2:F73**
   - Clique em F2
   - Segure Shift e clique em F73
   - OU: Clique em F2, depois use Ctrl+Shift+End para selecionar até ao final

2. **Abrir Data Validation**
   - Menu: **Data → Validity** (LibreOffice) OU **Data → Data Validation** (Excel)
   - OU: Botão direito → Data Validation

3. **Configurar validação**
   - **Allow:** List (Dropdown)
   - **Source/List:** Cole exatamente isto:
     ```
     Vence A,Vence B,A/S
     ```
   - **Show dropdown arrow:** ✓ Sim
   - **Show error message:** ✓ Sim
   - **Title:** `Valor Inválido`
   - **Message:** `Selecione: Vence A, Vence B, ou A/S`
   - **Clique OK**

### Para a Coluna G (Score) - Valores: "1&0", "1&1", etc

1. **Selecionar o intervalo G2:G73**

2. **Abrir Data Validation** (idem acima)

3. **Configurar validação**
   - **Allow:** List (Dropdown)
   - **Source/List:** Cole exatamente isto:
     ```
     1&0,1&1,1&2,1&3,2&0,2&1,2&2,2&3,3&0,3&1,3&2,3&3
     ```
   - **Show dropdown arrow:** ✓ Sim
   - **Show error message:** ✓ Sim
   - **Title:** `Formato Inválido`
   - **Message:** `Use formato X&Y (exemplo: 2&1)`
   - **Clique OK**

4. **Guardar ficheiro**

---

## 📋 Método 2: Adicionar via VBA (Se tem experiência)

Abra o Excel, pressione **Alt+F11** e cole este código na janela de módulo:

```vba
Sub AdicionarValidacaoDados()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("Calendario")
    
    ' Validação para Resultado (F2:F73)
    With ws.Range("F2:F73").Validation
        .Delete
        .Add Type:=xlList, AlertStyle:=xlValidAlertStop, Formula1:="Vence A,Vence B,A/S"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = True
        .ErrorTitle = "Valor Inválido"
        .ErrorMessage = "Selecione: Vence A, Vence B, ou A/S"
    End With
    
    ' Validação para Score (G2:G73)
    With ws.Range("G2:G73").Validation
        .Delete
        .Add Type:=xlList, AlertStyle:=xlValidAlertStop, Formula1:="1&0,1&1,1&2,1&3,2&0,2&1,2&2,2&3,3&0,3&1,3&2,3&3"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = True
        .ErrorTitle = "Formato Inválido"
        .ErrorMessage = "Use formato X&Y (exemplo: 2&1)"
    End With
    
    MsgBox "Validação adicionada com sucesso!", vbInformation
End Sub
```

Execute com: **Alt+F8** → Selecione "AdicionarValidacaoDados" → **Executar**

---

## ✅ Como usar após adicionar validação

1. **Abra** `Calendario_Resultados_IMPORT.xlsx`
2. **Navegue até um match** - p.ex. linha 2
3. **Clique em F2** (Coluna Resultado)
   - Vê um dropdown ↓ na célula
   - Selecione: "Vence A", "Vence B", ou "A/S"
4. **Clique em G2** (Coluna Score)
   - Vê um dropdown ↓ na célula
   - Selecione um score válido: "1&0", "1&1", etc.
5. **Preencha todos os matches**
6. **Guarde o ficheiro**
7. **Execute** `Export-CSVDoExcel.ps1` para exportar para CSV
8. **Importe no app** via Admin → Configurações → Importar Resultados

---

## 🐛 Troubleshooting

### Problema: "Dropdown não funciona"
- Certifique-se que os valores estão separados por **vírgula sem espaços**
- Verifique que selecionou o intervalo correto (F2:F73, G2:G73)

### Problema: "Mensagem de erro não aparece"
- Marque **Show error message** na caixa de validação

### Problema: "Valores com & não funcionam"
- Se usar VBA, use `&` diretamente (não é necessário escapar)
- Se usar a caixa de diálogo manual, também use `&` diretamente

---

## 📝 Próximos passos

1. **Adicione a validação** usando um dos métodos acima
2. **Preencha os resultados** para os matches
3. **Exporte para CSV** com `Export-CSVDoExcel.ps1`
4. **Importe na app** com a função de importação
5. **Verifique** os resultados na classificação

---

## 📞 Suporte

Se o dropdown não funcionar após seguir estes passos:
1. Verifique que o Excel é a versão 2010 ou posterior
2. Certifique-se de que selecionou **todo** o intervalo (F2:F73, não só F2)
3. Tente reabrir o ficheiro e recriar a validação
