const readline = require('readline');

const TAX_BRACKETS = [
  { limit: 20000,   base: 0,       rate: 0    },
  { limit: 30000,   base: 0,       rate: 0.02  },
  { limit: 40000,   base: 200,     rate: 0.035 },
  { limit: 80000,   base: 550,     rate: 0.07  },
  { limit: 120000,  base: 3350,    rate: 0.115 },
  { limit: 160000,  base: 7950,    rate: 0.15  },
  { limit: 200000,  base: 13950,   rate: 0.18  },
  { limit: 240000,  base: 21150,   rate: 0.19  },
  { limit: 280000,  base: 28750,   rate: 0.195 },
  { limit: 320000,  base: 36550,   rate: 0.20  },
  { limit: 500000,  base: 44550,   rate: 0.22  },
  { limit: 1000000, base: 84150,   rate: 0.23  },
  { limit: Infinity, base: 199150, rate: 0.24  },
];

function calculateTax(income) {
  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const bracket = TAX_BRACKETS[i];
    const prevLimit = i === 0 ? 0 : TAX_BRACKETS[i - 1].limit;
    if (income <= bracket.limit) {
      return bracket.base + (income - prevLimit) * bracket.rate;
    }
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter your chargeable income ($): ', (answer) => {
  const income = parseFloat(answer.replace(/,/g, ''));
  if (isNaN(income) || income < 0) {
    console.log('Please enter a valid income amount.');
  } else {
    const tax = calculateTax(income);
    const effectiveRate = income > 0 ? ((tax / income) * 100).toFixed(2) : '0.00';
    console.log(`\nChargeable Income:  $${income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Gross Tax Payable:  $${tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Effective Tax Rate: ${effectiveRate}%`);
  }
  rl.close();
});
