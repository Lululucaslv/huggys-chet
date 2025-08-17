import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { Brain, Loader2, AlertCircle } from 'lucide-react'

interface AISummary {
  summary: string
  keyTopics: string[]
  emotionalState: string
  concernAreas: string[]
  recommendations: string[]
}

interface AISummaryModalProps {
  clientUserId: string
  clientName: string
  disabled?: boolean
}

export default function AISummaryModal({ clientUserId, clientName, disabled }: AISummaryModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<AISummary | null>(null)
  const [error, setError] = useState('')

  const generateSummary = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'generatePreSessionSummary',
          userId: clientUserId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate summary')
      }

      const result = await response.json()
      
      if (result.success) {
        setSummary(result.data)
      } else {
        setError(result.error || 'Failed to generate summary')
      }
    } catch (err) {
      console.error('Error generating summary:', err)
      setError('生成摘要失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && !summary && !loading) {
      generateSummary()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
        >
          <Brain className="h-4 w-4 mr-1" />
          查看AI摘要
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI会前摘要 - {clientName}
          </DialogTitle>
        </DialogHeader>
        
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">正在生成摘要中，请稍候...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">整体情况摘要</h3>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">{summary.summary}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">主要讨论话题</h3>
              <div className="flex flex-wrap gap-2">
                {summary.keyTopics.map((topic, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">情绪状态评估</h3>
              <p className="text-gray-700 bg-yellow-50 p-3 rounded">{summary.emotionalState}</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">关注领域</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {summary.concernAreas.map((area, index) => (
                  <li key={index}>{area}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">建议</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {summary.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
