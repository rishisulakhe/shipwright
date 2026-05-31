import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export interface LiveChartDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
  fill?: boolean;
  borderDash?: number[];
}

interface LiveChartProps {
  title: string;
  labels: string[];
  datasets: LiveChartDataset[];
  yLabel?: string;
  min?: number;
  max?: number;
  currentValues?: { label: string; value: string; color: string }[];
}

export default function LiveChart({ title, labels, datasets, yLabel, min, max, currentValues }: LiveChartProps) {
  const chartData = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.borderColor,
      backgroundColor: ds.backgroundColor || ds.borderColor + '20',
      fill: ds.fill ?? false,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
      borderDash: ds.borderDash,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 200,
    },
    plugins: {
      legend: {
        display: datasets.length > 1,
        labels: {
          color: '#a1a1aa',
          font: { size: 11 },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#27272a',
        titleColor: '#e4e4e7',
        bodyColor: '#a1a1aa',
        borderColor: '#3f3f46',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: '#71717a',
          maxTicksLimit: 6,
          font: { size: 10 },
        },
        grid: {
          color: '#27272a',
        },
      },
      y: {
        display: true,
        min,
        max,
        title: yLabel
          ? { display: true, text: yLabel, color: '#71717a', font: { size: 11 } }
          : undefined,
        ticks: {
          color: '#71717a',
          font: { size: 10 },
        },
        grid: {
          color: '#27272a',
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      intersect: false,
    },
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        {currentValues && currentValues.length > 0 && (
          <div className="flex items-center gap-3">
            {currentValues.map((cv) => (
              <div key={cv.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cv.color }} />
                <span className="text-xs text-zinc-500">{cv.label}</span>
                <span className="text-sm font-semibold text-white">{cv.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-48">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}