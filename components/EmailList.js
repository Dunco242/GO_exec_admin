// components/EmailList.js
"use client"
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function EmailList() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/emails?page=${page}&pageSize=20`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setEmails(prev => [...prev, ...data.emails]);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [page]);

  return (
    <div className="space-y-2">
      {emails.map(email => (
        <div key={email.id} className="p-4 border rounded hover:bg-gray-50">
          <div className="flex justify-between">
            <span className="font-medium">{email.subject}</span>
            <span className="text-sm text-gray-500">
              {new Date(email.date).toLocaleString()}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            From: {email.from}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {email.preview}
          </p>
        </div>
      ))}

      <Button
        onClick={() => setPage(p => p + 1)}
        disabled={loading}
        className="mt-4"
      >
        {loading ? 'Loading...' : 'Load More'}
      </Button>
    </div>
  );
}
