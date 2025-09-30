import React from 'react';
import { Users, User, MapPin, Crown } from 'lucide-react';

interface SupervisedCellCardProps {
  id: string;
  name: string;
  supervisorName?: string;
  leaderName?: string;
  memberCount: number;
  onClick: (cellId: string) => void;
}

const SupervisedCellCard: React.FC<SupervisedCellCardProps> = ({
  id,
  name,
  supervisorName,
  leaderName,
  memberCount,
  onClick
}) => {
  return (
    <div
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-gray-200 p-6"
      onClick={() => onClick(id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg mr-3">
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {name}
            </h3>
            {leaderName && (
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Crown className="h-4 w-4 mr-1 text-yellow-600" />
                <span>Líder: {leaderName}</span>
              </div>
            )}
            {supervisorName && (
              <div className="flex items-center text-sm text-gray-500">
                <User className="h-4 w-4 mr-1" />
                <span>Supervisor: {supervisorName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-gray-600">
          <Users className="h-4 w-4 mr-1" />
          <span>
            {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
          </span>
        </div>
        
        <div className="text-sm text-blue-600 font-medium">
          Supervisionar →
        </div>
      </div>
    </div>
  );
};

export default SupervisedCellCard;