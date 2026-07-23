# EXCEL - Importação de Resultados - Guia de Utilização

## 📊 Arquivo: `Calendario_Resultados_IMPORT.xlsx`

### ✅ O que está feito:

1. **Estrutura profissional**
   - Cabeçalhos formatados (azul escuro, letra branca)
   - 72 linhas com todos os matches
   - Colunas de referência em cinza (read-only)
   - Colunas de edição em branco

2. **Campos por coluna:**
   - `matchId` — ID único (referência visual, NÃO EDITAR)
   - `Ronda` — Número da jornada (referência visual, NÃO EDITAR)
   - `Par` — Número do par (referência visual, NÃO EDITAR)
   - `Equipa Casa` — Nome (referência visual, NÃO EDITAR)
   - `Equipa Fora` — Nome (referência visual, NÃO EDITAR)
   - `Resultado` — **[EDITAR]** Valores: `Vence A`, `Vence B`, `A/S`
   - `Score (X&Y)` — **[EDITAR]** Formato: `2&1`, `1&0`, etc

3. **Primeira linha congelada** para melhor navegação

---

## 🔧 Como adicionar Validação (MANUAL em Excel)

Se quiser dropdowns com validação automática:

### Resultado (Coluna F)

1. Selecione F2:F73
2. Data → Validity/Data Validation
3. Tipo: **List**
4. Origem: `Vence A,Vence B,A/S`
5. ✓ Show list (dropdown)
6. **Apply**

### Score (Coluna G)

1. Selecione G2:G73
2. Data → Validity/Data Validation
3. Tipo: **Custom**
4. Fórmula: `REGEX(G2,"^\d+&\d+$")`
5. Mensagem: "Formato: X&Y (ex: 2&1)"
6. **Apply**

---

## 📝 Preenchimento

1. Abra `Calendario_Resultados_IMPORT.xlsx`
2. Preencha **apenas** as colunas `Resultado` e `Score`
3. Não edite as outras colunas
4. Guarde o ficheiro

Exemplo:
```
matchId    | Ronda | Par | Equipa Casa        | Equipa Fora    | Resultado | Score
R1-1-0     | 1     | 1   | Os 4 no Buraco     | Estela Birdies | Vence A   | 2&1
R1-2-1     | 1     | 2   | Os 4 no Buraco     | Estela Birdies | A/S       | 1&1
```

---

## 📤 Exportar para CSV

Execute o script PowerShell na mesma pasta:

```powershell
.\Export-CSVDoExcel.ps1
```

**O que faz:**
- Lê o Excel preenchido
- Valida os valores
- Exporta para `Calendario_Resultados_IMPORT.csv`
- Mostra erros encontrados

---

## 🚀 Importar na App

1. **Login como Admin** (admin / estela2026)
2. Aba **Configurações**
3. Secção **"Importar Resultados (CSV)"**
4. Clicar **"📤 Carregar CSV de Resultados"**
5. Selecionar `Calendario_Resultados_IMPORT.csv`
6. ✓ Resultados importados!

---

## 💡 Dicas

- **Sem acesso a Excel?** Edite o CSV diretamente (ficheiro de texto)
- **Erros na importação?** Verifique:
  - Resultado = exatamente `Vence A`, `Vence B` ou `A/S`
  - Score = formato `X&Y` (ex: `2&1`)
  - Não removeu linhas do ficheiro
- **Precisa de ajuda?** Veja a aba "Instruções" dentro do Excel

---

## 🔐 Segurança

- matchId identifica unicamente cada match (não pode ser alterado)
- Apenas Admin pode importar resultados
- CSV importa APENAS resultado e score
- Dados do match (equipas, ronda) nunca são tocados

Tudo seguro! ✅
